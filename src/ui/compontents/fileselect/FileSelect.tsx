import React, { useState, ReactNode } from "react";
import "./FileSelect.css";

type FileSelectProps = {
	onFilesReceived: (files: Record<string, string>) => void | Promise<void>;
	text: string;
	disabled?: boolean;
	onError?: (error: Error) => void;
};

export default function FileSelect({ onFilesReceived, text, disabled, onError }: FileSelectProps) {
	const handleFiles = async function (files: FileList) {
		const filesReceived: Record<string, string> = Object.create(null);

		const contentPromises = [] as Promise<void>[];
		for (const file of files) {
			contentPromises.push(
				(async () => {
					filesReceived[file.name] = await file.text();
				})(),
			);
		}

		await Promise.all(contentPromises);

		await onFilesReceived(filesReceived);
	};

	// triggers when file is selected with click
	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.preventDefault();
		if (e.target.files && e.target.files[0]) {
			void handleFiles(e.target.files).catch((error) =>
				onError?.(error instanceof Error ? error : new Error(String(error))),
			);
			e.target.value = "";
		}
	};

	return (
		<div className="file-select">
			<div className="file-select-input-wrapper">
				<input
					type="file"
					aria-label={`Import ${text}`}
					disabled={disabled}
					name="file-input"
					multiple={false}
					onChange={handleChange}
				/>
			</div>
			<div>{text}</div>
		</div>
	);
}
