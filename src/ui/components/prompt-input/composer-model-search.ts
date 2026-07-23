import { getModelSearchScore, type ModelOption } from "../models/ModelSelect.js";

export type ComposerModelOption = ModelOption & {
  displayLabel: string;
  detailLabel: string;
};

export function filterComposerModelOptions(
  options: ComposerModelOption[],
  query: string,
): ComposerModelOption[] {
  if (!query.trim()) return options;

  return options.filter((option) => getModelSearchScore(
    [option.displayLabel, option.detailLabel].filter(Boolean).join(" "),
    "",
    query,
  ) >= 0);
}
