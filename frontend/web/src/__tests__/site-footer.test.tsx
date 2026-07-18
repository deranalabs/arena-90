import { render, screen, within } from "@testing-library/react";

import { SiteFooter } from "@/components/site/SiteFooter";

describe("Arena90 site footer", () => {
  it("keeps product navigation in the header and exposes only trust links", () => {
    render(<SiteFooter />);
    const projectLinks = screen.getByRole("navigation", { name: "Project links" });

    expect(screen.queryByRole("navigation", { name: "Footer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Live Arena" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Replays" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Agents" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "How it works" })).not.toBeInTheDocument();
    expect(within(projectLinks).getByRole("link", { name: /github/i })).toHaveAttribute(
      "href",
      "https://github.com/deranalabs/arena-90",
    );
    expect(within(projectLinks).getByRole("link", { name: /^x/i })).toHaveAttribute(
      "href",
      "https://x.com/arena90ai",
    );
    expect(within(projectLinks).getByRole("link", { name: /txline docs/i })).toHaveAttribute(
      "href",
      "https://txline.txodds.com/documentation/quickstart",
    );
    expect(screen.queryByRole("link", { name: /watch live arena/i })).not.toBeInTheDocument();
    expect(screen.getByText(/supporter funds stay separate/i)).toBeInTheDocument();
  });
});
