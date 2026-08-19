const CSS_VARIABLE_BY_COLOR_KEY = {
  primary: '--color-primary',
  secondary: '--color-secondary',
  background: '--color-background',
  text: '--color-text',
};

export function themeToCssVariables(themeColors = {}) {
  return Object.fromEntries(
    Object.entries(CSS_VARIABLE_BY_COLOR_KEY)
      .filter(([colorKey]) => themeColors[colorKey] !== undefined)
      .map(([colorKey, cssVariable]) => [cssVariable, themeColors[colorKey]]),
  );
}

function defaultThemeTarget() {
  return typeof document !== 'undefined' ? document.documentElement : null;
}

export function applyTenantTheme(tenantConfig, target = defaultThemeTarget()) {
  if (!target) {
    return;
  }
  const variables = themeToCssVariables(tenantConfig.themeColors);
  for (const [name, value] of Object.entries(variables)) {
    target.style.setProperty(name, value);
  }
}
