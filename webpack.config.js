const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    index: './src/index.js',
    background: './src/background/background.js',
    content: './src/content.js',
    pip: './src/pip.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { 
          from: 'manifest.json',
          to: 'manifest.json',
          transform(content) {
            // Fix paths in manifest.json to point to dist directory
            const manifest = JSON.parse(content.toString());
            
            // Update paths for icons, popup, etc.
            if (manifest.icons) {
              Object.keys(manifest.icons).forEach(size => {
                // Keep the filename the same as in the public directory
                manifest.icons[size] = manifest.icons[size].replace('public/', '');
              });
            }
            
            if (manifest.action && manifest.action.default_icon) {
              Object.keys(manifest.action.default_icon).forEach(size => {
                // Keep the filename the same as in the public directory
                manifest.action.default_icon[size] = manifest.action.default_icon[size].replace('public/', '');
              });
            }
            
            if (manifest.action && manifest.action.default_popup) {
              manifest.action.default_popup = manifest.action.default_popup.replace('public/', '');
            }
            
            // Fix background script path
            if (manifest.background && manifest.background.service_worker) {
              manifest.background.service_worker = manifest.background.service_worker.replace(
                'src/background/background.js', 
                'background.js'
              );
            }
            
            // Fix content script path
            if (manifest.content_scripts && manifest.content_scripts.length > 0) {
              manifest.content_scripts.forEach(script => {
                if (script.js) {
                  script.js = script.js.map(js => js.replace('src/', ''));
                }
              });
            }
            
            return JSON.stringify(manifest, null, 2);
          }
        },
        { from: 'public/icons', to: 'icons' },
        { from: 'public/styles', to: 'styles' }
      ]
    }),
    new HtmlWebpackPlugin({
      template: 'public/popup.html',
      filename: 'popup.html',
      chunks: ['index'],
      scriptLoading: 'defer'
    }),
    new HtmlWebpackPlugin({
      template: 'public/floating.html',
      filename: 'floating.html',
      chunks: ['index'],
      scriptLoading: 'defer'
    }),
    new HtmlWebpackPlugin({
      template: 'public/pip.html',
      filename: 'pip.html',
      chunks: ['pip'],
      scriptLoading: 'defer'
    })
  ],
  resolve: {
    extensions: ['.js', '.jsx']
  },
  devtool: 'cheap-source-map'
}; 