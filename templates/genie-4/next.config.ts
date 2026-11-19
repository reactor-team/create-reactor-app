import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = { outputFileTracingRoot: path.resolve(__dirname) };
export default config;
