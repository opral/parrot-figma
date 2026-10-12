import * as React from "react";
import { useEffect, useRef, useState } from "react";

export type RowVisibilityRegistry = (
	element: Element,
	onVisibilityChange: (visible: boolean) => void,
) => () => void;

const estimatedRowHeight = 290;
const minimumSettledHeight = 100;

/**
 * A message row hosts several web component editors. Mounting thousands of them freezes the panel, so
 * the content is only mounted while the row is near the viewport; otherwise a placeholder with the
 * last measured height keeps the scroll geometry stable.
 */
export default function LazyMessageRow({
	messageId,
	initiallyVisible,
	register,
	children,
}: {
	messageId: string;
	initiallyVisible: boolean;
	register: RowVisibilityRegistry;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const height = useRef(estimatedRowHeight);
	const [visible, setVisible] = useState(initiallyVisible);

	useEffect(
		() =>
			register(ref.current!, (nowVisible) => {
				const element = ref.current;
				if (!element) return;
				// keep the row alive while it is being edited
				if (!nowVisible && element.contains(document.activeElement)) return;
				setVisible(nowVisible);
			}),
		[register],
	);

	// The editors render asynchronously, so only the settled size is a good placeholder height.
	useEffect(() => {
		const element = ref.current;
		if (!visible || !element) return;
		const observer = new ResizeObserver(([entry]) => {
			if (entry && entry.contentRect.height > minimumSettledHeight) {
				height.current = entry.contentRect.height;
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [visible]);

	return (
		<div
			ref={ref}
			data-message-id={messageId}
			className={visible ? undefined : "message-list-row-placeholder"}
			style={visible ? undefined : { height: height.current }}
		>
			{visible && children}
		</div>
	);
}
