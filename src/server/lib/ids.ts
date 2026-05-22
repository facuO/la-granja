import { nanoid } from "nanoid";
import { randomUUID } from "crypto";

export const uuid = (): string => randomUUID();
export const shortToken = (): string => nanoid(32);
export const sofiToken = (): string => nanoid(24);
