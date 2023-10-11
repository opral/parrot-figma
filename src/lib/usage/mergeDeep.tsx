// TODO translated characters:
// this thing is tricky because it will need to calculate based on different files
// if a user a uses file a and user b uses file b i cant know the amount of characters translated
/**
 * Performs a deep merge of `source` into `target`.
 * Mutates `target` only but not its objects and arrays.
 *
 * @author inspired by [jhildenbiddle](https://stackoverflow.com/a/48218209).
 */
export default function mergeDeep(target: any, source: any) {
  const isObject = (obj: any) => obj && typeof obj === 'object';

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      // eslint-disable-next-line no-param-reassign
      target[key] = targetValue.concat(sourceValue);
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      // eslint-disable-next-line no-param-reassign
      target[key] = mergeDeep({ ...targetValue }, sourceValue);
    } else {
      // eslint-disable-next-line no-param-reassign
      target[key] = sourceValue;
    }
  });

  return target;
}
