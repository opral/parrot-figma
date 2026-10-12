import * as React from "react";
import type FigmaUtil from "../../../shared/FigmaUtil";
import { CLOUD_INTEREST_FORM_URL, CloudIcon, featureGroups } from "./cloudContent";
import { capture } from "../../../lib/telemetry/Telemetry";
import "./CloudView.css";

// 16 px outline icons, drawn with the text color
const iconPaths: Record<CloudIcon, React.ReactNode> = {
	handoff: <path d="M2.5 5.5h10m0 0L10 3m2.5 2.5L10 8M13.5 10.5h-10m0 0L6 8m-2.5 2.5L6 13" />,
	sparkles: (
		<>
			<path d="M7 2.5l1.2 3.3 3.3 1.2-3.3 1.2L7 11.5 5.8 8.2 2.5 7l3.3-1.2z" />
			<path d="M12 10.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" />
		</>
	),
	book: (
		<path d="M8 4.5C6.8 3.5 5 3 2.5 3v9.5C5 12.5 6.8 13 8 14c1.2-1 3-1.5 5.5-1.5V3C11 3 9.2 3.5 8 4.5zm0 0V14" />
	),
	layout: (
		<>
			<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
			<path d="M2.5 6.5h11M6.5 6.5v7" />
		</>
	),
	key: (
		<>
			<circle cx="5.5" cy="10.5" r="3" />
			<path d="M7.6 8.4l5.4-5.4M11 5l1.5 1.5M9.5 6.5L11 8" />
		</>
	),
};

/** Parrot Cloud: what a hosted service would add - gauges interest, nothing is built yet. */
export default function CloudView({ figmaRemote }: { figmaRemote: FigmaUtil }) {
	return (
		<div className="cloud-view">
			{featureGroups.map((group) => (
				<section className="cloud-group" key={group.title}>
					<h3 className="cloud-group-title">{group.title}</h3>
					<ul className="cloud-features">
						{group.features.map(({ icon, name, description }) => (
							<li key={name}>
								<svg
									className="cloud-feature-icon"
									width="16"
									height="16"
									viewBox="0 0 16 16"
									aria-hidden="true"
								>
									{iconPaths[icon]}
								</svg>
								<span className="cloud-feature-name">{name}</span>
								<span className="cloud-feature-description">{description}</span>
							</li>
						))}
					</ul>
				</section>
			))}

			<div className="cloud-interest">
				<button
					type="button"
					className="button button-primary cloud-interest-button"
					onClick={() => {
						capture("cloud:interest_button_click", { topic: "cloud" });
						figmaRemote.openExternal(CLOUD_INTEREST_FORM_URL);
					}}
				>
					More information
				</button>
				<p>Tell us what your team needs. It takes 30 seconds.</p>
			</div>
		</div>
	);
}
