"use server";

/**
 * Admin server actions (TRD section 21).
 *
 * Every action re-authorizes independently. The `/admin` layout guard protects
 * the pages, but a server action is its own HTTP endpoint and can be invoked
 * directly by a customer, so the check cannot live only in the layout
 * (AGENTS.md section 6).
 */

import { revalidatePath } from "next/cache";
import {
  AdminInputError,
  NotAuthorisedError,
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  requireAdminProfile,
  setProductAvailability,
  updateOrderStatus,
  updateProduct,
  updateVariant,
} from "@/lib/admin";

/** Serializable result for useActionState. Never carries a raw Error. */
export type AdminActionResult =
  { ok: true; message: string } | { ok: false; error: string };

/** Message shown when a customer calls an admin action. Intentionally vague. */
const DENIED = "You do not have access to that.";

export async function updateOrderStatusAction(
  _previous: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  try {
    await requireAdminProfile();

    const orderId = String(formData.get("orderId") ?? "");
    const status = String(formData.get("status") ?? "");

    if (!orderId) {
      return { ok: false, error: "Missing order." };
    }

    await updateOrderStatus(orderId, status);

    // The confirmation page and order history show status, so refresh those.
    revalidatePath("/admin");
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}/confirmation`);

    return { ok: true, message: "Order status updated." };
  } catch (error) {
    if (error instanceof NotAuthorisedError) {
      return { ok: false, error: DENIED };
    }
    // The message is already customer-safe; log the detail server-side.
    console.error("admin status update failed:", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not update the order status.",
    };
  }
}

export async function setProductAvailabilityAction(
  _previous: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  const result = await runAdminAction(formData, async () => {
    const productId = String(formData.get("productId") ?? "");
    // Only the two intended values are accepted; never coerce arbitrary input.
    const next = String(formData.get("isAvailable"));

    if (!productId) {
      throw new AdminInputError("Missing product.");
    }

    if (next !== "true" && next !== "false") {
      throw new AdminInputError("Invalid availability value.");
    }

    const updated = await setProductAvailability(productId, next === "true");

    // Availability affects the catalog, product pages and cart.
    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/cart");

    return `${updated.name} is now ${
      updated.isAvailable ? "available" : "unavailable"
    }.`;
  });

  return result;
}

/**
 * Reads the dynamic variant rows submitted by the product editor.
 *
 * Rows arrive as `label`/`price` pairs under `variantLabel`/`variantPrice`,
 * repeated per row. Empty rows are dropped so an admin can leave a blank input
 * without that failing validation.
 */
function parseVariants(formData: FormData) {
  const labels = formData.getAll("variantLabel").map(String);
  const prices = formData.getAll("variantPrice").map(String);

  const variants = labels
    .map((label, index) => ({
      label: label.trim(),
      price: (prices[index] ?? "").trim(),
    }))
    .filter((variant) => variant.label !== "" || variant.price !== "");

  return variants.map((variant) => ({
    label: variant.label,
    price: variant.price,
  }));
}

export async function createProductAction(
  _previous: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  return runAdminAction(formData, async () => {
    const slug = String(formData.get("slug") ?? "").trim();

    const product = await createProduct({
      name: String(formData.get("name") ?? ""),
      slug: slug === "" ? undefined : slug,
      description: String(formData.get("description") ?? ""),
      category: String(formData.get("category") ?? ""),
      isAvailable: String(formData.get("isAvailable") ?? "true") === "true",
      variants: parseVariants(formData),
    });

    revalidateAdminPaths();
    revalidatePath("/");
    revalidatePath("/shop");

    return `Created ${product.name}.`;
  });
}

export async function updateProductAction(
  _previous: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  return runAdminAction(formData, async () => {
    const productId = String(formData.get("productId") ?? "");
    if (!productId) throw new AdminInputError("Missing product.");

    const slug = String(formData.get("slug") ?? "").trim();
    const description = String(formData.get("description") ?? "");
    const category = String(formData.get("category") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();

    const input: Record<string, unknown> = {};
    if (name) input.name = name;
    if (slug) input.slug = slug;
    if (category) input.category = category;
    // An empty description means "clear it".
    input.description = description;

    const product = await updateProduct(productId, input);

    revalidateAdminPaths();
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath(`/shop/${product.slug}`);

    return `Updated ${product.name}.`;
  });
}

export async function deleteProductAction(
  _previous: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  return runAdminAction(formData, async () => {
    const productId = String(formData.get("productId") ?? "");
    if (!productId) throw new AdminInputError("Missing product.");

    await deleteProduct(productId);

    revalidateAdminPaths();
    revalidatePath("/");
    revalidatePath("/shop");

    // Past orders keep their snapshots, so order pages stay valid; refreshing
    // them makes any open order view re-resolve cleanly.
    revalidatePath("/orders");

    return "Product deleted. Past orders are unaffected.";
  });
}

export async function createVariantAction(
  _previous: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  return runAdminAction(formData, async () => {
    const productId = String(formData.get("productId") ?? "");
    if (!productId) throw new AdminInputError("Missing product.");

    const variant = await createVariant(productId, {
      label: String(formData.get("label") ?? ""),
      price: String(formData.get("price") ?? ""),
    });

    revalidateAdminPaths();
    revalidatePath("/");
    revalidatePath("/shop");

    return `Added ${variant.label}.`;
  });
}

export async function updateVariantAction(
  _previous: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  return runAdminAction(formData, async () => {
    const variantId = String(formData.get("variantId") ?? "");
    if (!variantId) throw new AdminInputError("Missing option.");

    const input: Record<string, unknown> = {};
    const label = String(formData.get("label") ?? "").trim();
    const price = String(formData.get("price") ?? "").trim();
    if (label) input.label = label;
    if (price !== "") input.price = price;

    await updateVariant(variantId, input);

    revalidateAdminPaths();
    revalidatePath("/");
    revalidatePath("/shop");

    return "Option updated.";
  });
}

export async function deleteVariantAction(
  _previous: AdminActionResult | undefined,
  formData: FormData,
): Promise<AdminActionResult> {
  return runAdminAction(formData, async () => {
    const variantId = String(formData.get("variantId") ?? "");
    if (!variantId) throw new AdminInputError("Missing option.");

    await deleteVariant(variantId);

    revalidateAdminPaths();
    revalidatePath("/");
    revalidatePath("/shop");

    return "Option deleted. Past orders are unaffected.";
  });
}

function revalidateAdminPaths() {
  revalidatePath("/admin");
}

/**
 * Shared action wrapper: authorizes, converts errors to safe messages, and logs
 * detail server-side. Every action goes through this, so none of them can skip
 * the authorization check (AGENTS.md section 6).
 */
async function runAdminAction(
  formData: FormData,
  run: () => Promise<string>,
): Promise<AdminActionResult> {
  try {
    await requireAdminProfile();
    return { ok: true, message: await run() };
  } catch (error) {
    if (error instanceof NotAuthorisedError) {
      return { ok: false, error: DENIED };
    }

    if (error instanceof AdminInputError) {
      // Written to be read by an admin, so the message is safe to show.
      return { ok: false, error: error.message };
    }

    console.error("admin action failed:", error);
    return {
      ok: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
