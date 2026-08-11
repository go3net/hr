import { brands } from "@/brands";

export default function Home() {
  return (
    <main>
      <h1>LinkedIn Agent</h1>
      <p>Brands configured:</p>
      <ul>
        {Object.values(brands).map((brand) => (
          <li key={brand.slug}>
            <strong>{brand.displayName}</strong> — {brand.promise}
          </li>
        ))}
      </ul>
    </main>
  );
}
