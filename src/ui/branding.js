function isUppercaseLetter(char) {
  return char !== char.toLowerCase() && char === char.toUpperCase();
}

export function getBrandInitials(name = '') {
  const trimmed = name.trim();
  if (!trimmed) {
    return '';
  }

  const capitals = [...trimmed].filter(isUppercaseLetter);
  if (capitals.length >= 2) {
    return (capitals[0] + capitals[1]).toUpperCase();
  }

  const [firstWord] = trimmed.split(/\s+/);
  return firstWord.slice(0, 2).toUpperCase();
}
