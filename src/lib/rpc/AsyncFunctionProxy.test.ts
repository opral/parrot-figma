import { describe, expect, test, vi } from "vitest";
import { AsyncFunctionProxy } from "./AsyncFunctionProxy";

describe("Figma RPC", () => {
	test("ignores browser messages without a plugin payload", () => {
		const proxy = new AsyncFunctionProxy("test", vi.fn(), { on: vi.fn() });
		expect(() => proxy.handleMessage(undefined)).not.toThrow();
	});

	test("returns synchronous results and exceptions instead of leaving callers pending", async () => {
		const post = vi.fn();
		const proxy = new AsyncFunctionProxy("test", post, { on: vi.fn() });
		class Service {
			proxyClassName = "Service";
			value() { return 42; }
			fail() { throw new Error("Missing font"); }
		}
		proxy.registerInstance(new Service());
		await proxy.handleInvocationRequest({ name: "Service.value", id: "1", parameter: [] });
		expect(post.mock.calls[0][0]).toMatchObject({ invocationId: "1", result: 42 });
		await proxy.handleInvocationRequest({ name: "Service.fail", id: "2", parameter: [] });
		expect(post.mock.calls[1][0]).toMatchObject({ invocationId: "2", error: { message: "Missing font" } });
		await proxy.handleInvocationRequest({ name: "Service.missing", id: "3", parameter: [] });
		expect(post.mock.calls[2][0].error.message).toContain("does not exist");
	});

	test("releases completed request callbacks", () => {
		const proxy = new AsyncFunctionProxy("test", vi.fn(), { on: vi.fn() });
		const resolve = vi.fn();
		proxy.invocationRequests["1"] = { resolve };
		proxy.handleInvocationResult({ invocationId: "1", result: "done" });
		expect(resolve).toHaveBeenCalledWith("done");
		expect(proxy.invocationRequests).toEqual({});
	});
});
