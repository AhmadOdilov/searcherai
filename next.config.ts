import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

/**
 * next-intl plagini `i18n/request.ts` faylini topib, tarjimalarni
 * server komponentlariga ulaydi.
 */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {/* config options here */};

export default withNextIntl(nextConfig);
