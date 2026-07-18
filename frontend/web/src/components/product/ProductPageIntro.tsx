import type { ReactNode } from "react";

import styles from "./ProductPageIntro.module.css";

type ProductPageIntroBaseProps = {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
};

type ProductPageIntroProps = ProductPageIntroBaseProps & (
  | { layout?: "split"; meta?: never }
  | { layout: "front-page"; meta: string }
);

export function ProductPageIntro({
  eyebrow,
  title,
  description,
  aside,
  layout = "split",
  meta,
}: ProductPageIntroProps) {
  if (layout === "front-page") {
    return (
      <section className={styles.frontPage} aria-labelledby="product-page-title">
        <header className={styles.frontPageTopline}>
          <p className="product-eyebrow">{eyebrow}</p>
          <p className={styles.meta}>{meta}</p>
        </header>
        <div className={styles.frontPageGrid}>
          <h1 className={styles.frontPageTitle} id="product-page-title">{title}</h1>
          <div className={styles.frontPageDetail}>
            <p className={styles.frontPageLede}>{description}</p>
            {aside ? <aside className={styles.frontPageAside}>{aside}</aside> : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.intro} aria-labelledby="product-page-title">
      <div className={styles.copy}>
        <p className="product-eyebrow">{eyebrow}</p>
        <h1 className={styles.title} id="product-page-title">{title}</h1>
        <p className={styles.lede}>{description}</p>
      </div>
      {aside ? <aside className={styles.aside}>{aside}</aside> : null}
    </section>
  );
}
