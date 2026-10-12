import type { BundleNested as BundleRows } from "@inlang/sdk/browser";
import type { BundleNested } from "./FigmaBundleStore";

export type { BundleRows };

/**
 * Parrot keeps bundles in the camelCase shapes of Inlang plugins (`bundleId`, `messageId`); the SDK's
 * database and the editor components use its database rows (`bundle_id`, `message_id`).
 */
export function toRows(bundle: BundleNested): BundleRows {
	return {
		id: bundle.id,
		declarations: bundle.declarations,
		messages: bundle.messages.map(({ bundleId, variants, ...message }) => ({
			...message,
			bundle_id: bundleId,
			variants: variants.map(({ messageId, ...variant }) => ({
				...variant,
				message_id: messageId,
			})),
		})),
	};
}

/** Inverse of `toRows`. */
export function fromRows(bundle: BundleRows): BundleNested {
	return {
		id: bundle.id,
		declarations: bundle.declarations,
		messages: bundle.messages.map(({ bundle_id, variants, ...message }) => ({
			id: message.id,
			bundleId: bundle_id,
			locale: message.locale,
			selectors: message.selectors,
			variants: variants.map(({ message_id, ...variant }) => ({
				id: variant.id,
				messageId: message_id,
				matches: variant.matches,
				pattern: variant.pattern,
			})),
		})),
	};
}
