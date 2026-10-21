// Central runtime platform detection (Capacitor). Web is the default.
import { Capacitor } from "@capacitor/core";

export const getPlatform = () => Capacitor.getPlatform(); // "web" | "ios" | "android"
export const isNative = () => Capacitor.isNativePlatform();
export const isIOS = () => getPlatform() === "ios";
export const isAndroid = () => getPlatform() === "android";
