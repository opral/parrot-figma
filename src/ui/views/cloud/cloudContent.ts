export type CloudIcon = "handoff" | "sparkles" | "book" | "layout" | "key";

export const featureGroups: {
	title: string;
	features: { icon: CloudIcon; name: string; description: string }[];
}[] = [
	{
		title: "Design and code in sync",
		features: [
			{
				icon: "handoff",
				name: "Automatic handoff between designers, developers, and translators",
				description: "Through a CLI, REST API, or your CI. No more sending JSON files around.",
			},
		],
	},
	{
		title: "AI",
		features: [
			{
				icon: "sparkles",
				name: "AI translation",
				description: "Fill in every missing language at once.",
			},
			{
				icon: "book",
				name: "Your terminology and tone",
				description: "Product names stay as they are. Your style guide is followed.",
			},
			{
				icon: "layout",
				name: "Translations that fit the design",
				description: "Knows buttons from headings and keeps text within its space.",
			},
			{
				icon: "key",
				name: "Smart message keys",
				description: "Meaningful keys like checkout.continue_button, generated for you.",
			},
		],
	},
];

/**
 * The shared "Interest in Cloud" Google Form (also linked from Fink, Sherlock and Paraglide JS), with
 * "Parrot" pre-selected for "Which product brought you here?" (entry 14901479).
 */
export const CLOUD_INTEREST_FORM_URL =
	"https://docs.google.com/forms/d/e/1FAIpQLSdwui1r1rFu1AXMPKa-g2ggDHOTvNFrmrxWDubaaYLHv8_4Mg/viewform?usp=pp_url&entry.14901479=Parrot";
