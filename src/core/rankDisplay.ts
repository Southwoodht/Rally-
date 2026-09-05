// How a column of ratings is written down, which is a different question
// from what order they go in.
//
// The table rounds ratings to whole numbers, and two players can round to
// the same one while genuinely sitting apart — Adrian on 18.48 above Charlie
// Henry on 17.41, both printed "18". The sort is right and the screen looks
// broken: identical numbers in different positions, which any reader
// correctly reads as a bug in the app. Rating bars make it worse rather than
// better, since two visibly different bars will sit above two identical
// numbers.
//
// So the precision follows the data instead of being fixed in advance: whole
// numbers until whole numbers stop being able to tell two neighbours apart,
// and one decimal for the pair that collided. Nothing about the underlying
// values changes — this is only how they are printed.
//
// Pure and importless on purpose, so it can be tested without dragging the
// theme and the Supabase client in behind it.

/**
 * Display strings for a column of values **in the order they are shown**.
 *
 * Adjacency is the whole rule: only neighbours can look wrong together,
 * because only neighbours are read against each other. Two players printing
 * "18" at ranks 3 and 11 is nobody's confusion.
 *
 * A run of three or more colliding neighbours all gain a decimal, since each
 * adjacent pair in the run marks both of its members.
 *
 * If two values still collide at one decimal they are within 0.05 of each
 * other, and the decimal is not shown at all — it would print the same digits
 * on both rows while implying a precision that resolves nothing. Chasing it
 * with more decimals would show noise as if it were signal.
 */
export function ratingColumn(values: number[]): string[] {
  const rounded = values.map((v) => Math.round(v));
  const decimal = values.map(() => false);
  for (let i = 1; i < values.length; i++) {
    // Only when the decimal actually separates them. Ten winless players all
    // on exactly nought round the same AND print the same at one decimal, so
    // adding it buys nothing and costs a column of "0.0" that looks like a
    // rendering fault. They are equal; "0" is the honest way to say it.
    if (rounded[i] === rounded[i - 1] && values[i].toFixed(1) !== values[i - 1].toFixed(1)) {
      decimal[i] = true;
      decimal[i - 1] = true;
    }
  }
  return values.map((v, i) => (decimal[i] ? v.toFixed(1) : String(rounded[i])));
}
