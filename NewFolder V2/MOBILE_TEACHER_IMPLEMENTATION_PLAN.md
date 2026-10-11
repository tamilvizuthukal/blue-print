# Teacher Mobile Native Workspace — Implementation Plan

## Scope and compatibility promise

- Keep the existing `UserDashboard`, `UniversalBlueprintView`, desktop report styling, and admin portal available as they are.
- Mount the new workspace only for `Role.USER` on narrow viewports (up to 767 px). Desktop users continue to receive the existing `UserDashboard`, including when they browse directly to `/teacher-mobile`.
- Use the existing authentication/session guard, role values, blueprint/curriculum/discourse APIs, `Blueprint` storage schema, spell-check dictionary endpoints, PDF/Word export hooks, and report components.
- Optional mobile-specific fields are additive (`mobileQuestionMode`, `mobileAnswerMode`, and `multipleChoice.correctOptionIds`) so legacy records remain readable and compatible.

## Implemented screens

1. **Exam home/list** — mobile search, exam cards, class/subject/term/year/set metadata, completion indicator, profile and logout controls.
2. **Selected exam home** — exam summary plus the four requested grid actions: Blue Print, Question Paper, Reports View, and Analysis.
3. **Blue Print** — shows the existing `BlueprintMatrix` as the main content, with its existing allocation validation and save/confirm actions. Mobile mode uses long-press-and-drag to move items and double-tap to open the current item editor; desktop behavior remains the default when the flag is not supplied.
4. **Question Paper** — a dedicated, compact question editor with the question area first and answer area below; metadata is in a slide-in right-side information drawer.
5. **Reports View** — reuses the established report and Answer Key components, and the existing PDF/Word export pipeline.
6. **Analysis** — summarizes question/answer completion, section fill, unit marks, and cognitive-process distribution with mobile-readable progress bars.

## Question and answer rules

- **SR1 / MCI:** four option inputs and one correct radio selection. The selected answer is immediately generated into `answerText`; the answer heading is omitted.
- **SR2 / MI — matching:** two unlettered text columns, with a mapping control for each left-side row; the answer key is assembled from the mapping.
- **SR2 / MI — choose statements:** four option inputs and multi-select checkboxes; every selected statement is assembled into the answer key.
- **Other formats:** paragraph or table answer editor, optional discourse rubric, and direct answer text can coexist with a discourse rubric.
- For formats other than SR1, the answer heading is required for 2+ mark answers unless a discourse rubric is used alone. A discourse-only answer does not require an answer heading or answer text.
- The question picker marks a question complete only when the question and its corresponding answer requirements have been satisfied.
- Existing dictionary spelling-check, suggestions, and “add word” endpoints are wired to the editor. Native text areas preserve the system keyboard's built-in copy/paste, and explicit Copy/Paste actions are included where clipboard permission is available.

## Integration steps

1. Add `TeacherMobileApp.tsx` and its scoped mobile stylesheet.
2. Add an opt-in `mobileGestures` property to `BlueprintMatrix`; keep its existing gesture behavior when this property is not supplied.
3. Add the role + viewport guard in `App.tsx`: teachers on phones get the new UI; desktop teachers continue to get `UserDashboard`.
4. Add optional mobile question-mode fields to `BlueprintItem` and support multiple correct statement IDs while preserving the prior single answer ID.
5. Add the answer heading to generated Answer Key only for mobile-authored items, preventing changes to old answer-key output.

## Verification checklist

- [ ] Test with a `Role.USER` account at a phone viewport and confirm the four exam-home tiles work.
- [ ] Test the desktop Teacher Dashboard and administrator portal at desktop viewport; compare with the original deployment.
- [ ] Test each existing blueprint: open, edit, save, reload, and confirm metadata persists.
- [ ] Test SR1: all four options, one correct selection, automatic answer key output, and no answer heading.
- [ ] Test SR2 matching: add rows, create mappings, save/reload, and confirm generated key matches the mappings.
- [ ] Test SR2 choose-statements: multiple correct checkboxes, automatic answer key, and required heading when 2+ marks.
- [ ] Test paragraph and table answers with/without discourse, including discourse-only input.
- [ ] Test Tamil spell-check, replacing a suggestion, adding a word, copy/paste, drawer scrolling, safe-area insets, and a small 320 px wide viewport.
- [ ] Test matrix long-press drag-to-move and double-tap editor on iOS Safari and Android Chrome.
- [ ] Run `npm ci`, `npm run build`, and `npm run test:exact-weightage` in an environment with npm registry access and backend credentials.

## Current validation note

The modified TS/TSX files passed TypeScript `transpileModule` syntax/transpile checks. A full Vite build could not be executed because the root `node_modules` are absent and installing dependencies was blocked by a network DNS error (`EAI_AGAIN` from `registry.npmjs.org`). `npm run test:exact-weightage` was also attempted but could not start because the `esbuild` package is unavailable in this environment. Browser/device, data-persistence, and gesture tests remain to be run in the project's connected development environment before production deployment.
