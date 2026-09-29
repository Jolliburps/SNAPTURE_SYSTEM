const React = require('react');
const { View } = require('react-native');

module.exports = {
  __esModule: true,
  Camera: ({ children, ...props }) => React.createElement(View, props, children),
  useCameraDevice: () => ({ id: 'mock-back-camera', position: 'back' }),
  useCameraPermission: () => ({ hasPermission: true, canRequestPermission: false, requestPermission: async () => true }),
  usePhotoOutput: () => ({ capturePhotoToFile: async () => ({ filePath: '/tmp/snapture-test.jpg' }) }),
};
