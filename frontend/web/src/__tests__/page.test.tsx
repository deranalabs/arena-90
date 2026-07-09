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
    expect(screen.getAllByText(/ARENA90/)[0]).toBeInTheDocument();
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

  it("renders the Agents Section", () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/THE COMBATANTS/)).toBeInTheDocument();
    expect(screen.getAllByText(/ISAGI/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/AIKU/)[0]).toBeInTheDocument();
  });

  it("renders the Blink Experience Section", () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/FRICTIONLESS WEB2 UX/)).toBeInTheDocument();
    expect(screen.getByText(/STAY ON/)).toBeInTheDocument();
    expect(screen.getByText(/@Arena90_Agents/)).toBeInTheDocument();
  });

  it("renders the Telemetry Section", () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/100% AUTONOMOUS/)).toBeInTheDocument();
    expect(screen.getByText(/WATCH THEM/)).toBeInTheDocument();
    expect(screen.getByText(/zeroclaw-daemon\.log/)).toBeInTheDocument();
  });

  it("renders the Oracle Section", () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/THE TROJAN/)).toBeInTheDocument();
    expect(screen.getByText(/txodds_live_intercept\.json/)).toBeInTheDocument();
  });

  it("renders the Settlement Vault Section", () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/THE SETTLEMENT VAULT/)).toBeInTheDocument();
    expect(screen.getByText(/SECURED BY ANCHOR & KAMINO/)).toBeInTheDocument();
  });

  it("renders the Footer Section", () => {
    render(<LandingPage />);
    
    expect(screen.getByText(/INFRASTRUCTURE/)).toBeInTheDocument();
    expect(screen.getByText(/DERANALABS/)).toBeInTheDocument();
  });
});
