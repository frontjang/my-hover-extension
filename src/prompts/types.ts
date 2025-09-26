export interface LineProcessorParams {
  lineText: string;
  word: string;
}

export interface LineProcessor {
  readonly id: string;
  process(params: LineProcessorParams): Promise<string | undefined>;
}
