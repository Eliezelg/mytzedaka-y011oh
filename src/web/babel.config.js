// @babel/preset-env ^7.22.0
// @babel/preset-react ^7.22.0
// @babel/preset-typescript ^7.22.0
// core-js ^3.30.0

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        // Configure for modern browser support (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
        targets: {
          chrome: '90',
          firefox: '88',
          safari: '14',
          edge: '90'
        },
        // Optimize polyfill injection
        useBuiltIns: 'usage',
        corejs: {
          version: 3,
          proposals: true
        },
        // Keep ESM modules for better tree-shaking
        modules: false,
        // Enable loose mode for better performance
        loose: true,
        // Disable debug output in production
        debug: process.env.NODE_ENV === 'development',
        // Include required features for RTL support
        include: [
          '@babel/plugin-transform-spread',
          '@babel/plugin-transform-destructuring',
          '@babel/plugin-transform-parameters'
        ]
      }
    ],
    [
      '@babel/preset-react',
      {
        // Use new JSX transform
        runtime: 'automatic',
        // Enable development mode features in dev environment
        development: process.env.NODE_ENV === 'development',
        // Configure for emotion styling library
        importSource: '@emotion/react',
        // Enable pure annotations for better optimization
        pure: true,
        // Enable throwIfNamespace for better JSX validation
        throwIfNamespace: true
      }
    ],
    [
      '@babel/preset-typescript',
      {
        // Enable TSX support
        isTSX: true,
        // Apply to all extensions
        allExtensions: true,
        // Enable namespace support for legacy code
        allowNamespaces: true,
        // Optimize const enums
        optimizeConstEnums: true,
        // Enable JSX preservation for emotion
        jsxPragma: '__jsx',
        // Support both .ts and .tsx files
        onlyRemoveTypeImports: true
      }
    ]
  ],
  // Enable module source type for ESM
  sourceType: 'module',
  // Generate source maps in development
  sourceMaps: process.env.NODE_ENV === 'development',
  // Ignore node_modules except for core-js
  ignore: [/node_modules\/(?!core-js)/],
  // Enable caching for faster builds
  cacheDirectory: true,
  // Minify in production
  minified: process.env.NODE_ENV === 'production',
  // Remove console.log in production
  compact: process.env.NODE_ENV === 'production'
}