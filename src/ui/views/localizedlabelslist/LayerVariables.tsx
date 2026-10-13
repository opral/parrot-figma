import * as React from "react";
import type { Message } from "../../../lib/message/LegacyMessage";
import type { MessageParameterValues } from "../../../lib/message/MessageParameterValues";
import { layerVariables, pickVariant } from "../../../lib/message/LayerVariant";
import TextField from "../../compontents/textfield/TextField";

type LayerVariablesProps = {
	message: Message;
	language: string;
	parameterValues: MessageParameterValues;
	/** the text of the layer was edited and not saved to the message yet: a new value would replace it */
	locked: boolean;
	onChange: (name: string, value: string) => void;
};

/**
 * The variables the forms of a message are chosen by (a plural's `count`, a `gender` select), with the
 * value this layer has for each: it decides which form of the message the layer shows.
 */
export default function LayerVariables({
	message,
	language,
	parameterValues,
	locked,
	onChange,
}: LayerVariablesProps) {
	const variables = layerVariables(message);
	if (variables.length === 0) return null;
	const form = pickVariant(message, language, parameterValues)?.match.filter(
		(value) => value !== "",
	);

	return (
		<div className="layer-variables">
			{variables.map(({ input, plural }) => {
				const value = parameterValues[input]?.value ?? "";
				return (
					<div
						key={input}
						className="layer-variable"
						data-tooltip-content={
							locked
								? `The text of this layer was changed. Use "Update message" or "Revert" before you change ${input}: the layer would show the text of the message again.`
								: plural
									? `The number of ${input} in this layer. It decides which form of the message the layer shows (${form?.join(" · ") ?? "other"}).`
									: `The value of ${input} in this layer. It decides which form of the message the layer shows. Empty shows the "other" form.`
						}
					>
						<span className="layer-variable-name">{input}</span>
						{locked ? (
							<span className="layer-variable-value">{value || (plural ? "number" : "other")}</span>
						) : (
							<TextField
								singleClick
								text={value}
								placeholder={plural ? "number" : "other"}
								onSave={(text: string) => {
									if (text.trim() !== value) onChange(input, text);
								}}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
