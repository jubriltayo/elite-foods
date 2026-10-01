import Image from "next/image";
import { cn } from "@/lib/cn";
import { productImage } from "@/lib/product-images";
import type { Product } from "@/lib/products";

/**
 * Product imagery.
 *
 * Renders `image_url` when an admin has uploaded one, otherwise the temporary
 * local illustration for that product (see lib/product-images.ts). Sold-out
 * products get the hatch overlay so the state is legible without relying on
 * colour alone (PRD section 5.2).
 */
export function ProductMedia({
  product,
  className,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
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
          <span className="rounded-full bg-band px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-on-band">
            Sold out
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Circular category thumbnail, as used in the category rail.
 *
 * Categories are not stored as rows, so the thumbnail is a crop of a
 * representative product from that category rather than a dedicated asset.
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
        "relative size-full overflow-hidden rounded-full bg-cream ring-4 ring-paper",
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
