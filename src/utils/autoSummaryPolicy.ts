import type {
  VideoCategoryInfo,
  VideoCategoryKey,
} from '../types';

export type AutoSummaryCategoryMode = 'all' | 'include' | 'exclude';

export type AutoSummarySkipReason =
  | 'autoDisabled'
  | 'tooShort'
  | 'categoryExcluded'
  | 'categoryNotIncluded'
  | 'categoryUnknown';

interface AutoSummaryGateInput {
  autoSummarize: boolean;
  minDurationForAutoSec: number;
  durationSec: number;
  category?: VideoCategoryInfo | null;
  categoryMode: AutoSummaryCategoryMode;
  selectedCategories: readonly VideoCategoryKey[];
}

type AutoSummaryGateResult =
  | { allowed: true; reason: null }
  | { allowed: false; reason: AutoSummarySkipReason };

export function evaluateAutoSummaryGate(
  input: AutoSummaryGateInput
): AutoSummaryGateResult {
  if (!input.autoSummarize) {
    return { allowed: false, reason: 'autoDisabled' };
  }

  const hasKnownShortDuration =
    input.durationSec > 0 &&
    input.minDurationForAutoSec > 0 &&
    input.durationSec < input.minDurationForAutoSec;
  if (hasKnownShortDuration) {
    return { allowed: false, reason: 'tooShort' };
  }

  if (input.categoryMode === 'all') {
    return { allowed: true, reason: null };
  }

  if (!input.category) {
    return input.categoryMode === 'include'
      ? { allowed: false, reason: 'categoryUnknown' }
      : { allowed: true, reason: null };
  }

  const isSelected = input.selectedCategories.includes(input.category.key);
  if (input.categoryMode === 'include') {
    return isSelected
      ? { allowed: true, reason: null }
      : { allowed: false, reason: 'categoryNotIncluded' };
  }

  return isSelected
    ? { allowed: false, reason: 'categoryExcluded' }
    : { allowed: true, reason: null };
}
