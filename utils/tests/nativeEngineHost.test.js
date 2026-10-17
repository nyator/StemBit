// The engine pages run unchanged on native audio through nativeEngineHost.
// This checks the part that can break without a device: that each page's
// script loads against the host's window/document stand-ins without touching
// anything they don't provide, and that the message channel works both ways.
import { createNativeEngineHost } from "../nativeEngineHost";
import { buildLoopEngineHtml } from "../../constants/loopEngine";
import { buildSessionEngineHtml } from "../../constants/sessionEngine";

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("nativeEngineHost", () => {
  it.each([
    ["loop", buildLoopEngineHtml()],
    ["session", buildSessionEngineHtml()],
  ])("runs the %s engine page and answers a ping", async (_name, html) => {
    const replies = [];
    const host = createNativeEngineHost(html, (data) => replies.push(JSON.parse(data)));

    host.postMessage(JSON.stringify({ type: "ping" }));
    await settle();
    host.dispose();

    expect(replies.filter((reply) => reply.type === "error")).toEqual([]);
    expect(replies.filter((reply) => reply.type === "pong")).toHaveLength(1);
  });

  // The page posts "ready" while it is still being run, inside
  // createNativeEngineHost. Delivered then, the host context answered into a
  // host that didn't exist yet and its replies (the loop click's config among
  // them) were lost -- the click stayed off until a setting re-sent it.
  it("holds the page's start-up replies until the host has been returned", async () => {
    let host = null;
    const sawHost = [];
    host = createNativeEngineHost(buildLoopEngineHtml(), (data) => {
      if (JSON.parse(data).type === "ready") sawHost.push(host !== null);
    });
    expect(sawHost).toEqual([]);
    await settle();
    host.dispose();
    expect(sawHost).toEqual([true]);
  });

  it("goes quiet once disposed", async () => {
    const replies = [];
    const host = createNativeEngineHost(buildLoopEngineHtml(), (data) =>
      replies.push(data)
    );
    // Whatever the page said while starting up ("ready") isn't the question.
    await settle();
    replies.length = 0;
    host.dispose();
    host.postMessage(JSON.stringify({ type: "ping" }));
    await settle();
    expect(replies).toEqual([]);
  });
});
