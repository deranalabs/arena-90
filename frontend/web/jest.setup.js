import "@testing-library/jest-dom";
import React from "react";

// Provide a robust mock for framer-motion to prevent DOM prop errors in tests
jest.mock("framer-motion", () => {
  const createMockElement = (Tag) => {
    const MotionMock = ({ children, ...props }) => {
      // Isolate and remove framer-motion specific props before passing to standard DOM elements
      const domProps = { ...props };
      delete domProps.initial;
      delete domProps.animate;
      delete domProps.whileInView;
      delete domProps.viewport;
      delete domProps.transition;
      delete domProps.exit;
      delete domProps.variants;
      delete domProps.layoutId;
      delete domProps.layout;

      // Render the standard DOM element without the animation props
      return React.createElement(Tag, domProps, children);
    };

    MotionMock.displayName = `MotionMock(${Tag})`;
    return MotionMock;
  };

  return {
    motion: {
      article: createMockElement("article"),
      div: createMockElement("div"),
      h1: createMockElement("h1"),
      h2: createMockElement("h2"),
      h3: createMockElement("h3"),
      p: createMockElement("p"),
      span: createMockElement("span"),
      a: createMockElement("a"),
      button: createMockElement("button"),
      ul: createMockElement("ul"),
      li: createMockElement("li"),
      // Add other HTML elements as needed
    },
    AnimatePresence: ({ children }) => <>{children}</>,
    useReducedMotion: () => false,
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
    useScroll: () => ({ scrollYProgress: { onChange: jest.fn(), get: () => 0 } }),
    useTransform: () => 0,
    useSpring: () => 0,
    useInView: () => true,
  };
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    // Trigger intersection immediately for tests
    this.callback([{ isIntersecting: true }]);
  }
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = MockIntersectionObserver;
