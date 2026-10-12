import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type OutsideClickHandlerProps = {
	children: ReactNode;
	disabled?: boolean;
	display?: CSSProperties["display"];
	additionalInsideRef?: { current: HTMLElement | null };
	onOutsideClick: (event: MouseEvent | TouchEvent) => void;
};

export function isClickOutside(target: Node, roots: readonly (ParentNode | null | undefined)[]) {
	return !roots.some((root) => root?.contains(target));
}

export default function OutsideClickHandler({
	children,
	disabled = false,
	display = "block",
	additionalInsideRef,
	onOutsideClick,
}: OutsideClickHandlerProps) {
	const root = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (disabled) return;

		const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
			if (
				event.target instanceof Node &&
				isClickOutside(event.target, [root.current, additionalInsideRef?.current])
			) {
				onOutsideClick(event);
			}
		};

		document.addEventListener("mousedown", handleOutsideClick, true);
		document.addEventListener("touchstart", handleOutsideClick, true);
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick, true);
			document.removeEventListener("touchstart", handleOutsideClick, true);
		};
	}, [additionalInsideRef, disabled, onOutsideClick]);

	return (
		<div ref={root} style={{ display }}>
			{children}
		</div>
	);
}
