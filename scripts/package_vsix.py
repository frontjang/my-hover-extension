#!/usr/bin/env python3
"""Lightweight VSIX packager built around the compiled `out/` folder.

The script reads `package.json`, verifies the compiled entrypoint exists,
then zips the extension into a VSIX archive whose layout mirrors the
structure emitted by `vsce`.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import os
from pathlib import Path
from typing import Iterable, List, Set, Tuple
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON = ROOT / "package.json"
DEFAULT_OUTPUT_DIR = ROOT

# Directories that should never ship in the final VSIX bundle.
IGNORED_DIRS: Set[str] = {
    ".git",
    "node_modules",
    "tmp",
    "tmp_vsix",
    "__pycache__",
}

IGNORED_FILES: Set[str] = {
    ".DS_Store",
}

CONTENT_TYPES_OVERRIDES = {
    ".vsixmanifest": "text/xml",
    ".js": "application/javascript",
    ".map": "application/json",
    ".json": "application/json",
    ".ts": "video/mp2t",
}


class PackagingError(RuntimeError):
    """Custom error for packaging failures."""


def load_package_metadata() -> dict:
    try:
        with PACKAGE_JSON.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as exc:
        raise PackagingError("package.json not found. Are you in the project root?") from exc
    except json.JSONDecodeError as exc:
        raise PackagingError("package.json is not valid JSON") from exc


def resolve_output_path(metadata: dict, override: str | None) -> Path:
    if override:
        return Path(override).resolve()
    name = metadata.get("name")
    version = metadata.get("version")
    if not name or not version:
        raise PackagingError("package.json must declare both `name` and `version`")
    filename = f"{name}-{version}.vsix"
    return (DEFAULT_OUTPUT_DIR / filename).resolve()


def ensure_compiled_entry(metadata: dict) -> Path:
    main_entry = metadata.get("main", "out/extension.js")
    main_path = ROOT / main_entry
    if not main_path.exists():
        raise PackagingError(
            f"Compiled entry '{main_entry}' was not found. Run `npm run compile` first."
        )
    return main_path


def should_ignore(path: Path) -> bool:
    parts = path.parts
    for idx, part in enumerate(parts):
        if part in IGNORED_DIRS:
            return True
        if idx == len(parts) - 1 and part in IGNORED_FILES:
            return True
    return False


def iter_extension_files() -> Iterable[Path]:
    for root, dirnames, filenames in os.walk(ROOT):
        rel_root = Path(root).relative_to(ROOT)
        # Mutate dirnames in-place so os.walk skips ignored directories.
        dirnames[:] = [d for d in dirnames if not should_ignore(rel_root / d)]
        for filename in filenames:
            relative = rel_root / filename
            if should_ignore(relative):
                continue
            if relative == Path("scripts/package_vsix.py"):
                # Exclude the packager itself to keep parity with vsce output size.
                continue
            yield relative


def build_manifest(metadata: dict) -> str:
    ns = "http://schemas.microsoft.com/developer/vsx-schema/2011"
    d_ns = "http://schemas.microsoft.com/developer/vsx-schema-design/2011"
    ET.register_namespace("", ns)
    ET.register_namespace("d", d_ns)

    manifest = ET.Element(f"{{{ns}}}PackageManifest", attrib={"Version": "2.0.0"})

    metadata_el = ET.SubElement(manifest, f"{{{ns}}}Metadata")
    identity = ET.SubElement(
        metadata_el,
        f"{{{ns}}}Identity",
        attrib={
            "Language": "en-US",
            "Id": metadata.get("name", ""),
            "Version": metadata.get("version", ""),
            "Publisher": metadata.get("publisher", ""),
        },
    )

    display_name = metadata.get("displayName", identity.attrib["Id"])
    ET.SubElement(metadata_el, f"{{{ns}}}DisplayName").text = display_name

    description = ET.SubElement(
        metadata_el,
        f"{{{ns}}}Description",
        attrib={"xml:space": "preserve"},
    )
    description.text = metadata.get("description", "")

    tags = ",".join(metadata.get("keywords", []))
    ET.SubElement(metadata_el, f"{{{ns}}}Tags").text = tags

    categories = metadata.get("categories", [])
    ET.SubElement(metadata_el, f"{{{ns}}}Categories").text = ",".join(categories)

    ET.SubElement(metadata_el, f"{{{ns}}}GalleryFlags").text = "Public"

    properties_el = ET.SubElement(metadata_el, f"{{{ns}}}Properties")

    engine = metadata.get("engines", {}).get("vscode", "")
    ET.SubElement(
        properties_el,
        f"{{{ns}}}Property",
        attrib={
            "Id": "Microsoft.VisualStudio.Code.Engine",
            "Value": engine,
        },
    )

    extension_dependencies = ",".join(metadata.get("extensionDependencies", []))
    ET.SubElement(
        properties_el,
        f"{{{ns}}}Property",
        attrib={
            "Id": "Microsoft.VisualStudio.Code.ExtensionDependencies",
            "Value": extension_dependencies,
        },
    )

    extension_pack = ",".join(metadata.get("extensionPack", []))
    ET.SubElement(
        properties_el,
        f"{{{ns}}}Property",
        attrib={
            "Id": "Microsoft.VisualStudio.Code.ExtensionPack",
            "Value": extension_pack,
        },
    )

    extension_kind = metadata.get("extensionKind", "workspace")
    if isinstance(extension_kind, list):
        extension_kind_value = ",".join(extension_kind)
    else:
        extension_kind_value = extension_kind
    ET.SubElement(
        properties_el,
        f"{{{ns}}}Property",
        attrib={
            "Id": "Microsoft.VisualStudio.Code.ExtensionKind",
            "Value": extension_kind_value,
        },
    )

    localized_languages: List[str] = []
    for entry in metadata.get("contributes", {}).get("localizations", []) or []:
        language_id = entry.get("languageId")
        if language_id:
            localized_languages.append(language_id)
    ET.SubElement(
        properties_el,
        f"{{{ns}}}Property",
        attrib={
            "Id": "Microsoft.VisualStudio.Code.LocalizedLanguages",
            "Value": ",".join(localized_languages),
        },
    )

    ET.SubElement(
        properties_el,
        f"{{{ns}}}Property",
        attrib={
            "Id": "Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown",
            "Value": "true",
        },
    )

    ET.SubElement(
        properties_el,
        f"{{{ns}}}Property",
        attrib={
            "Id": "Microsoft.VisualStudio.Services.Content.Pricing",
            "Value": "Free",
        },
    )

    installation_el = ET.SubElement(manifest, f"{{{ns}}}Installation")
    ET.SubElement(
        installation_el,
        f"{{{ns}}}InstallationTarget",
        attrib={"Id": "Microsoft.VisualStudio.Code"},
    )

    ET.SubElement(manifest, f"{{{ns}}}Dependencies")

    assets_el = ET.SubElement(manifest, f"{{{ns}}}Assets")
    ET.SubElement(
        assets_el,
        f"{{{ns}}}Asset",
        attrib={
            "Type": "Microsoft.VisualStudio.Code.Manifest",
            "Path": "extension/package.json",
            "Addressable": "true",
        },
    )

    xml_bytes = ET.tostring(manifest, encoding="utf-8", xml_declaration=True)
    return xml_bytes.decode("utf-8")


def detect_content_types(files: Iterable[Path]) -> List[Tuple[str, str]]:
    mimetypes.init()
    content_types = {
        ".vsixmanifest": CONTENT_TYPES_OVERRIDES[".vsixmanifest"],
    }
    for path in files:
        ext = path.suffix
        if not ext:
            continue
        if ext in CONTENT_TYPES_OVERRIDES:
            content_types[ext] = CONTENT_TYPES_OVERRIDES[ext]
            continue
        mime, _ = mimetypes.guess_type(f"file{ext}")
        if mime:
            content_types[ext] = mime
    ordered = sorted(content_types.items())
    return ordered


def build_content_types_xml(pairs: List[Tuple[str, str]]) -> str:
    ns = "http://schemas.openxmlformats.org/package/2006/content-types"
    root = ET.Element("Types", attrib={"xmlns": ns})
    for extension, content_type in pairs:
        ET.SubElement(
            root,
            "Default",
            attrib={"Extension": extension, "ContentType": content_type},
        )
    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return xml_bytes.decode("utf-8")


def package_extension(output: Path, metadata: dict) -> None:
    ensure_compiled_entry(metadata)
    files = sorted(iter_extension_files())
    content_type_pairs = detect_content_types(files)
    manifest_xml = build_manifest(metadata)
    content_types_xml = build_content_types_xml(content_type_pairs)

    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        archive.writestr("extension.vsixmanifest", manifest_xml)
        archive.writestr("[Content_Types].xml", content_types_xml)
        for relative_path in files:
            archive.write(ROOT / relative_path, arcname=str(Path("extension") / relative_path))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Package the extension into a VSIX archive")
    parser.add_argument(
        "--output",
        "-o",
        help="Override output path for the generated VSIX file",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    metadata = load_package_metadata()
    output_path = resolve_output_path(metadata, args.output)
    package_extension(output_path, metadata)
    print(f"VSIX created at {output_path}")


if __name__ == "__main__":
    main()
