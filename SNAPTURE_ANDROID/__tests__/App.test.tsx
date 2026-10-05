/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { BottomNavigation } from '../src/MainExperience';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

test('keeps Camera centered in the primary navigation', async () => {
  const navigate = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<BottomNavigation active="home" navigate={navigate} />);
  });
  const tabs = renderer.root.findAllByProps({ accessibilityRole: 'tab' });
  expect([...new Set(tabs.map((tab) => tab.props.accessibilityLabel))]).toEqual(['Home', 'Learn', 'Camera', 'Waste', 'Profile']);
  const camera = tabs.find((tab) => tab.props.accessibilityLabel === 'Camera' && typeof tab.props.onPress === 'function');
  expect(camera).toBeDefined();
  await ReactTestRenderer.act(() => camera?.props.onPress());
  expect(navigate).toHaveBeenCalledWith('camera');
});
