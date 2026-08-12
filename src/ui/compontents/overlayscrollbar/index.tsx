import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	type ComponentPropsWithoutRef,
	type ForwardedRef,
} from "react";
import type { EventListeners, PartialOptions } from "overlayscrollbars";
import { ClickScrollPlugin, OverlayScrollbars } from "overlayscrollbars";
import { useOverlayScrollbars } from "overlayscrollbars-react";

OverlayScrollbars.plugin(ClickScrollPlugin);

export type OverlayScrollbarsComponentProps = ComponentPropsWithoutRef<"div"> & {
	options?: PartialOptions | false | null;
	events?: EventListeners | false | null;
	defer?: boolean | IdleRequestOptions;
};

export interface OverlayScrollbarsComponentRef {
	osInstance(): OverlayScrollbars | null;
	getElement(): HTMLDivElement | null;
}

function OverlayScrollbarsComponentImpl(
	props: OverlayScrollbarsComponentProps,
	ref: ForwardedRef<OverlayScrollbarsComponentRef>,
) {
	const { options, events, defer, children, ...other } = props;
	const elementRef = useRef<HTMLDivElement>(null);
	const childrenRef = useRef<HTMLDivElement>(null);
	const [initialize, osInstance] = useOverlayScrollbars({ options, events, defer });

	useEffect(() => {
		const element = elementRef.current;
		const childrenElement = childrenRef.current;
		if (element && childrenElement) {
			initialize({
				target: element,
				elements: {
					viewport: childrenElement,
					content: childrenElement,
				},
			});
		}
		return () => osInstance()?.destroy();
	}, [initialize, osInstance]);

	useImperativeHandle(ref, () => ({ osInstance, getElement: () => elementRef.current }), [osInstance]);

	return (
		<div data-overlayscrollbars-initialize="" ref={elementRef} {...other}>
			<div data-overlayscrollbars-contents="" ref={childrenRef}>
				{children}
			</div>
		</div>
	);
}

export const OverlayScrollbarsComponent = forwardRef(OverlayScrollbarsComponentImpl);
