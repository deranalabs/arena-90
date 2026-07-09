import { render, screen } from "@testing-library/react";
import React from "react";
import LandingPage from "../app/page";

// Provide a basic mock for framer-motion to prevent errors in tests
jest.mock("framer-motion", () => {
  const createMockElement = (Tag: keyof React.JSX.IntrinsicElements) => {
    const MotionMock = ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => {
      const domProps = { ...props };

      delete domProps.animate;
      delete domProps.initial;
      delete domProps.transition;
      delete domProps.viewport;
      delete domProps.whileInView;

      return React.createElement(Tag, domProps, children);
    };

    MotionMock.displayName = `MotionMock(${Tag})`;

    return MotionMock;
  };

  return {
    motion: {
      article: createMockElement("article"),
      div: createMockElement("div"),
      p: createMockElement("p"),
    },
  };
});

describe("Home Page", () => {
  it("renders the Riot HUD elements", () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/SYSTEM_ONLINE/)).toBeInTheDocument();
    expect(screen.getByText(/ARENA90/)).toBeInTheDocument();
  });
  
  it("renders the navigation links", () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/\[ AGENTS \]/)).toBeInTheDocument();
    expect(screen.getByText(/\[ ORACLE \]/)).toBeInTheDocument();
  });

  it("renders the Hero content", () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/CHOOSE/)).toBeInTheDocument();
    expect(screen.getByText(/JOIN THE ARENA/)).toBeInTheDocument();
  });

  it("renders the agent lock section", () => {
    render(<LandingPage />);

    expect(screen.getByText(/SECTION_02 \/\/ AGENT_LOCK/)).toBeInTheDocument();
    expect(screen.getByText(/TWO MODELS/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ISAGI" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AIKU" })).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE_MARKET/)).toBeInTheDocument();
  });
});
