import React, { useState, useEffect, useRef } from "react";
import OutsideClickHandler from "../outsideClickHandler/OutsideClickHandler";
import "./Tooltip.css";

interface TooltipProps {
	contentAttribute: string;
}

interface Placement {
	top: number;
	left: number;
	position: string;
	/** left edge of the tooltip box (`left` is the x of the arrow) */
	contentLeft?: number;
}

export default function Tooltip({ contentAttribute }: TooltipProps) {
	const [tooltipVisible, setTooltipVisible] = useState(false);
	const [tooltipPlacement, setTooltipPlacement] = useState<any | Placement>({
		top: 0,
		left: 0,
		position: "none",
	});
	const [tooltipSourceRect, setTooltipSourceRect] = useState<DOMRect | undefined>(undefined);
	const tooltipContentEl = useRef<HTMLDivElement | null>(null);
	const tooltipSourceRef = useRef<HTMLElement | undefined>(undefined);

	const tooltipVisibleRef = useRef(tooltipVisible);
	tooltipVisibleRef.current = tooltipVisible;
	const [tooltipContent, setTooltipContent] = useState("");
	const hideTooltipTimeoutRef = useRef<any | undefined>(undefined);
	const showTooltipTimeoutRef = useRef<any | undefined>(undefined);

	const hideTimeout = 600;
	const showTimeout = 1000;

	const handleMouseLeave = () => {
		if (showTooltipTimeoutRef.current) {
			clearTimeout(showTooltipTimeoutRef.current);
			showTooltipTimeoutRef.current = undefined;
		}

		// set a new timeout to hide the tooltip
		if (hideTooltipTimeoutRef.current !== undefined) {
			clearTimeout(hideTooltipTimeoutRef.current);
		}
		hideTooltipTimeoutRef.current = setTimeout(() => {
			setTooltipVisible(false);
		}, hideTimeout);
	};

	const showTooltip = (target: HTMLElement) => {
		// set a new timeout to hide the tooltip
		if (hideTooltipTimeoutRef.current !== undefined) {
			clearTimeout(hideTooltipTimeoutRef.current);
			hideTooltipTimeoutRef.current = undefined;
		}

		const content = target.getAttribute(contentAttribute)!;
		tooltipSourceRef.current = target;
		setTooltipSourceRect(target.getBoundingClientRect());
		setTooltipVisible(true);
		setTooltipContent(content);
		setTooltipPlacement(undefined);
	};

	useEffect(() => {
		if (tooltipPlacement !== undefined) {
			return;
		}

		// calculate the box and try to fit it below.
		// - try center, try left or use right
		// else place on top
		// - try center, try left or use right

		const element = tooltipContentEl.current;
		if (element === null || tooltipSourceRect === undefined) {
			return;
		}

		const elementRect = element.getBoundingClientRect();
		const height = elementRect.height + 8;

		// the tooltip stays inside the plugin window, the arrow keeps pointing at the source
		const margin = 8;
		const windowWidth = document.documentElement.clientWidth || window.innerWidth;
		const parent = document.getElementById("react-page");
		const parentRect = parent?.getBoundingClientRect();
		const windowBottom = parentRect?.bottom ?? window.innerHeight;
		const minLeft = margin;
		const maxLeft = Math.max(minLeft, windowWidth - elementRect.width - margin);
		const center = tooltipSourceRect.left + tooltipSourceRect.width / 2;
		const contentLeft = Math.min(maxLeft, Math.max(minLeft, center - elementRect.width / 2));
		const arrowLeft = Math.min(
			contentLeft + elementRect.width - margin - 4,
			Math.max(contentLeft + margin + 4, center),
		);

		// fits below the source? else place it on top
		const below = windowBottom - tooltipSourceRect.bottom > height;
		const placement: Placement = {
			top: below ? tooltipSourceRect.bottom : tooltipSourceRect.top - height,
			left: arrowLeft,
			contentLeft,
			position: below ? "bottom-center" : "top-center",
		};
		setTooltipPlacement(placement);
		if (placement.top === 0 && placement.left === 0) {
			setTooltipVisible(false);
		}
	}, [tooltipPlacement]);

	// a tooltip must not outlive its element (e.g. a row that disappears under the resting mouse)
	useEffect(() => {
		if (!tooltipVisible) return;
		const interval = setInterval(() => {
			if (!tooltipSourceRef.current?.isConnected) setTooltipVisible(false);
		}, 250);
		return () => clearInterval(interval);
	}, [tooltipVisible]);

	useEffect(() => {
		const handleMouseOver = (event: MouseEvent) => {
			if (!(event.target instanceof HTMLElement)) {
				return;
			}

			const target = event.target as HTMLElement;

			let tooltipSource: HTMLElement | undefined;
			let currentEl = target as HTMLElement | null;

			while (currentEl) {
				if (currentEl.matches("[data-tooltip-content]")) {
					tooltipSource = currentEl;
					break;
				}

				currentEl = currentEl.parentElement;
			}

			if (tooltipSource === undefined) {
				return;
			}

			const content = tooltipSource.getAttribute(contentAttribute);
			if (content) {
				if (!tooltipVisibleRef.current) {
					// we can reset the hide timeout and directly show the new one
					if (showTooltipTimeoutRef.current !== undefined) {
						clearTimeout(showTooltipTimeoutRef.current);
					}
					showTooltipTimeoutRef.current = setTimeout(() => {
						showTooltip(tooltipSource!);
					}, showTimeout);
				} else {
					// set a timeout to show the tooltip
					showTooltip(tooltipSource);
				}

				// prepare hiding of the tooltip:
				tooltipSource.addEventListener("mouseleave", handleMouseLeave, { once: true });

				event.stopPropagation();
			}
		};

		document.addEventListener("mouseover", handleMouseOver);

		function onScroll() {
			setTooltipVisible(false);
		}

		document.addEventListener("wheel", onScroll);

		// pressing a control acts on it: its tooltip must not stay on top of what opens next
		function onPress() {
			if (showTooltipTimeoutRef.current !== undefined) {
				clearTimeout(showTooltipTimeoutRef.current);
				showTooltipTimeoutRef.current = undefined;
			}
			setTooltipVisible(false);
		}

		document.addEventListener("mousedown", onPress, true);

		return () => {
			document.removeEventListener("mouseover", handleMouseOver);
			document.removeEventListener("wheel", onScroll);
			document.removeEventListener("mousedown", onPress, true);
		};
	}, []);

	let arrowDirection = "up";
	if (tooltipPlacement && tooltipPlacement.position.indexOf("top") !== -1) {
		arrowDirection = "down";
	}

	return (
		<OutsideClickHandler
			onOutsideClick={() => {
				setTooltipVisible(false);
			}}
			disabled={!tooltipVisible}
		>
			<div
				className="tooltip--notInteractive"
				style={{ visibility: tooltipVisible && tooltipPlacement ? "visible" : "hidden" }}
			>
				<div
					className={`tooltip--${arrowDirection}Arrow tooltip--arrowInset tooltip--arrow`}
					style={{
						top: tooltipPlacement?.top ?? 0,
						left: tooltipPlacement?.left ?? 0,
					}}
				/>
				<div
					ref={tooltipContentEl}
					className={`tooltip--content tooltip--content-${arrowDirection}`}
					style={{
						top: tooltipPlacement?.top ?? 0,
						left: tooltipPlacement?.contentLeft ?? tooltipPlacement?.left ?? 0,
						transform: "none",
					}}
					dir="auto"
				>
					<span className="tooltip--text">{tooltipContent}</span>
				</div>
			</div>
		</OutsideClickHandler>
	);
}
