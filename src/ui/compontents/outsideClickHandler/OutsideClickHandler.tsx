import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type OutsideClickHandlerProps = {
	children: ReactNode;
	disabled?: boolean;
	display?: CSSProperties["display"];
	onOutsideClick: (event: MouseEvent | TouchEvent) => void;
};

export default function OutsideClickHandler({
	children,
	disabled = false,
	display = "block",
	onOutsideClick,
}: OutsideClickHandlerProps) {
	const root = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (disabled) return;

		const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
			if (event.target instanceof Node && !root.current?.contains(event.target)) {
				onOutsideClick(event);
			}
		};

		document.addEventListener("mousedown", handleOutsideClick, true);
		document.addEventListener("touchstart", handleOutsideClick, true);
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick, true);
			document.removeEventListener("touchstart", handleOutsideClick, true);
		};
	}, [disabled, onOutsideClick]);

	return (
		<div ref={root} style={{ display }}>
			{children}
		</div>
	);
}
