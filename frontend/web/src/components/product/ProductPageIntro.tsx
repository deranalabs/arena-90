import type { ReactNode } from "react";

type ProductPageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
};

export function ProductPageIntro({
  eyebrow,
  title,
  description,
  aside,
}: ProductPageIntroProps) {
  return (
    <section className="product-intro" aria-labelledby="product-page-title">
      <div className="product-intro__copy">
        <p className="product-eyebrow">{eyebrow}</p>
        <h1 id="product-page-title">{title}</h1>
        <p className="product-lede">{description}</p>
      </div>
      {aside ? <aside className="product-intro__aside">{aside}</aside> : null}
    </section>
  );
}
