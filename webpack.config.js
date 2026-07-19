const extendConfig = require('openmrs/default-webpack-config');

// Some OpenMRS packages (notably `@openmrs/esm-patient-common-lib`) are
// published as raw TypeScript source with no compiled `dist` output, so the
// consuming app is responsible for transpiling them. The default OpenMRS
// webpack config excludes all of `node_modules` from the swc-loader, which
// causes "Module parse failed: The keyword 'interface' is reserved" errors for
// these packages. We narrow that exclusion so their source is transpiled too.
const sourceOnlyOpenmrsPackages = ['@openmrs/esm-patient-common-lib'];

function isExcludedFromTranspilation(modulePath) {
  if (!/[\\/]node_modules[\\/]/.test(modulePath)) {
    return false; // our own source — always transpile
  }
  const normalized = modulePath.split('\\').join('/');
  return !sourceOnlyOpenmrsPackages.some((pkg) => normalized.includes(`node_modules/${pkg}/`));
}

function usesSwcLoader(rule) {
  const entries = Array.isArray(rule.use) ? rule.use : [rule.use];
  return entries.some((entry) => String((entry && entry.loader) || entry).includes('swc-loader'));
}

// Because we now transpile the source of some OpenMRS packages (above), the
// type-checker follows imports into third-party `node_modules` source and
// reports pre-existing type errors from those packages (e.g. esm-globals,
// esm-styleguide). Those aren't our code, so exclude node_modules from the
// fork-ts-checker issues while keeping type-checking for our own source.
function excludeNodeModulesFromTypeCheck(config) {
  for (const plugin of config.plugins || []) {
    if (plugin && plugin.constructor && plugin.constructor.name === 'ForkTsCheckerWebpackPlugin') {
      plugin.options = plugin.options || {};
      plugin.options.issue = plugin.options.issue || {};
      const existing = plugin.options.issue.exclude;
      const excludes = Array.isArray(existing) ? existing.slice() : existing ? [existing] : [];
      excludes.push({ file: '**/node_modules/**' });
      plugin.options.issue.exclude = excludes;
    }
  }
}

module.exports = (env, argv = {}) => {
  const config = extendConfig(env, argv);

  for (const rule of config.module.rules || []) {
    if (rule && rule.use && usesSwcLoader(rule)) {
      rule.exclude = isExcludedFromTranspilation;
    }
  }

  excludeNodeModulesFromTypeCheck(config);

  return config;
};
