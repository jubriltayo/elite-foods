import Image from "next/image";
import { cn } from "@/lib/cn";
import { productImage } from "@/lib/product-images";
import type { Product } from "@/lib/products";

/**
 * Product imagery.
 *
 * Renders `image_url` when an admin has uploaded one, otherwise the temporary
 * illustration for that product. The art sits on its own tinted block with a
 * soft radius so the product reads as an object on a stage rather than a photo
 * cropped into a card.
 *
 * Sold-out products keep their art and gain a hatch overlay plus a rose badge,
 * so the state is legible without relying on colour alone (PRD section 5.2).
 */
export function ProductMedia({
  product,
  className,
  sizes = "(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw",
  priority = false,
}: {
  product: Pick<
    Product,
    "slug" | "name" | "category" | "imageUrl" | "isAvailable"
  >;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-cream",
        !product.isAvailable && "hatch",
        className,
      )}
    >
      <Image
        src={productImage(product)}
        alt={product.name}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />

      {!product.isAvailable && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-paper">
            Sold out
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Circular category thumbnail for the category rail.
 *
 * Categories are a fixed enum rather than table rows, so the circle borrows the
 * art of a representative product from that category.
 */
export function CategoryThumb({
  product,
  className,
}: {
  product: Pick<
    Product,
    "slug" | "name" | "category" | "imageUrl" | "isAvailable"
  >;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative size-full overflow-hidden rounded-full bg-cream",
        className,
      )}
    >
      <Image
        src={productImage(product)}
        alt=""
        fill
        sizes="120px"
        className="object-cover"
      />
    </div>
  );
}
