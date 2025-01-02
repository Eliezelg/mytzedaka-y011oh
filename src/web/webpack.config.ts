import path from 'path';
import webpack from 'webpack'; // ^5.88.0
import HtmlWebpackPlugin from 'html-webpack-plugin'; // ^5.5.3
import TerserPlugin from 'terser-webpack-plugin'; // ^5.3.9
import CompressionPlugin from 'compression-webpack-plugin'; // ^10.0.0
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer'; // ^4.9.0
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import WorkboxPlugin from 'workbox-webpack-plugin';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
import CopyPlugin from 'copy-webpack-plugin';

interface Environment {
  production?: boolean;
  development?: boolean;
  analyze?: boolean;
}

const getWebpackConfig = (env: Environment = {}): webpack.Configuration => {
  const isProduction = env.production || process.env.NODE_ENV === 'production';
  const shouldAnalyze = env.analyze || process.env.ANALYZE_BUNDLE === 'true';
  const mode = isProduction ? 'production' : 'development';

  return {
    mode,
    target: ['web', 'es2020'],
    
    entry: {
      main: [
        './src/polyfills.ts', // Browser polyfills
        './src/index.tsx', // Main application entry
      ],
      vendor: './src/vendor.ts', // Vendor bundle
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[chunkhash].js' : '[name].chunk.js',
      publicPath: '/',
      clean: true,
      crossOriginLoading: 'anonymous',
    },

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@pages': path.resolve(__dirname, 'src/pages'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@store': path.resolve(__dirname, 'src/store'),
        '@interfaces': path.resolve(__dirname, 'src/interfaces'),
        '@config': path.resolve(__dirname, 'src/config'),
        '@validators': path.resolve(__dirname, 'src/validators'),
        '@contexts': path.resolve(__dirname, 'src/contexts'),
        '@styles': path.resolve(__dirname, 'src/styles'),
        '@i18n': path.resolve(__dirname, 'src/i18n'),
      },
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            'thread-loader',
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                happyPackMode: true,
                configFile: path.resolve(__dirname, 'tsconfig.json'),
              },
            },
          ],
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  localIdentName: isProduction
                    ? '[hash:base64]'
                    : '[path][name]__[local]',
                },
                importLoaders: 1,
              },
            },
            'postcss-loader',
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8192, // 8kb
            },
          },
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },
      ],
    },

    optimization: {
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      },
      runtimeChunk: 'single',
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            compress: {
              drop_console: isProduction,
              drop_debugger: isProduction,
            },
            format: {
              comments: false,
            },
          },
        }),
      ],
      moduleIds: 'deterministic',
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: 'src/index.html',
        inject: true,
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        } : false,
      }),

      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.PUBLIC_URL': JSON.stringify('/'),
      }),

      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: path.resolve(__dirname, 'tsconfig.json'),
        },
      }),

      new webpack.ContextReplacementPlugin(
        /moment[/\\]locale$/,
        /en|he|fr/
      ),

      ...(isProduction ? [
        new CompressionPlugin({
          filename: '[path][base].gz',
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 10240,
          minRatio: 0.8,
        }),
        new WorkboxPlugin.GenerateSW({
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        }),
        new WebpackManifestPlugin({
          fileName: 'asset-manifest.json',
          publicPath: '/',
        }),
      ] : []),

      ...(shouldAnalyze ? [
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: 'bundle-report.html',
        }),
      ] : []),
    ],

    devServer: {
      historyApiFallback: true,
      hot: true,
      port: 3000,
      proxy: {
        '/api': 'http://localhost:8000',
      },
      client: {
        overlay: true,
      },
      compress: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },

    devtool: isProduction ? 'source-map' : 'eval-source-map',

    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },

    stats: {
      children: false,
      modules: false,
    },
  };
};

export default getWebpackConfig;