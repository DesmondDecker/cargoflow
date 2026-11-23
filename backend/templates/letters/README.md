# Letter templates

Each `.docx` here is one of the agency's real letters with every variable piece of text replaced by a `{{field}}` token. The layout, fonts and fixed wording are the original's; only the tokens change when a letter is generated.

## Add a letter

1. Open the original letter in Word and replace each piece of variable text with a token such as `{{bl_number}}`. A token must be typed in one go (do not change the formatting in the middle of it), or Word may split it across runs and it will not be found.
2. Save it in this folder.
3. Add an entry to `src/services/letters/letterTemplates.ts`: its key, title, the carrier it is addressed to, the file name, and one entry per token. Add how to fill it from shipment and client records in `prefillLetter`.
4. Run the tests. `letterTemplates.test.ts` fails if the field list and the tokens in the file disagree.

The app's Letters screens are driven by that list, so nothing else changes.

## Notes

- A value is never put into the file unescaped, and characters Word cannot open are removed.
- A token's red / yellow-highlight / italic styling is removed from the filled value, so it looks like the rest of the letter.
- The original wording is kept as it is, including "bill of loading" and "SUB REQUEST" in the Maersk letter.
- `src/services/letters/__fixtures__` holds the two reference letters. The renderer test checks that rendering reproduces them exactly.
