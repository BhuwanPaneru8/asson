module.exports = [
"[project]/src/app/(shop)/layout.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ShopLayout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$header$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/site/header.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$footer$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/site/footer.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$shop$2d$provider$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/site/shop-provider.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$cart$2f$cart$2d$drawer$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/cart/cart-drawer.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/cart.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
async function ShopLayout({ children }) {
    const [cart, user] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$cart$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCart"])(),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCurrentUser"])()
    ]);
    const wishlist = user ? (await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].wishlistItem.findMany({
        where: {
            userId: user.id
        },
        select: {
            productId: true
        }
    })).map((w)=>w.productId) : [];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$shop$2d$provider$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ShopProvider"], {
        cart: cart,
        user: user && {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        },
        wishlist: wishlist,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "#main",
                className: "sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:bg-ink focus:px-3 focus:py-2 focus:text-white",
                children: "Skip to content"
            }, void 0, false, {
                fileName: "[project]/src/app/(shop)/layout.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$header$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Header"], {}, void 0, false, {
                fileName: "[project]/src/app/(shop)/layout.tsx",
                lineNumber: 15,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                id: "main",
                className: "flex-1",
                children: children
            }, void 0, false, {
                fileName: "[project]/src/app/(shop)/layout.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$footer$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Footer"], {}, void 0, false, {
                fileName: "[project]/src/app/(shop)/layout.tsx",
                lineNumber: 17,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$cart$2f$cart$2d$drawer$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["CartDrawer"], {}, void 0, false, {
                fileName: "[project]/src/app/(shop)/layout.tsx",
                lineNumber: 18,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/(shop)/layout.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/app/(shop)/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/(shop)/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/src/components/cart/cart-drawer.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CartDrawer",
    ()=>CartDrawer
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const CartDrawer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call CartDrawer() from the server but CartDrawer is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/cart/cart-drawer.tsx", "CartDrawer");
}),
"[project]/src/components/cart/cart-drawer.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$cart$2f$cart$2d$drawer$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/components/cart/cart-drawer.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$cart$2f$cart$2d$drawer$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/components/site/footer.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Footer",
    ()=>Footer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$catalog$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/catalog.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$logo$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/site/logo.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$newsletter$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/site/newsletter.tsx [app-rsc] (ecmascript)");
;
;
;
;
;
;
const cols = [
    {
        title: "Shop",
        links: [
            [
                "Men",
                "/c/men"
            ],
            [
                "Women",
                "/c/women"
            ],
            [
                "Kids",
                "/c/kids"
            ],
            [
                "New in",
                "/shop?sort=new"
            ],
            [
                "Sale",
                "/shop?sale=1"
            ]
        ]
    },
    {
        title: "Help",
        links: [
            [
                "Track your order",
                "/track"
            ],
            [
                "Shipping & delivery",
                "/help#shipping"
            ],
            [
                "Returns & exchanges",
                "/help#returns"
            ],
            [
                "Size guide",
                "/size-guide"
            ],
            [
                "Contact us",
                "/help#contact"
            ]
        ]
    },
    {
        title: "Account",
        links: [
            [
                "Sign in",
                "/login"
            ],
            [
                "Create account",
                "/register"
            ],
            [
                "Orders",
                "/account/orders"
            ],
            [
                "Wishlist",
                "/account/wishlist"
            ]
        ]
    }
];
async function Footer() {
    const hasSale = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$catalog$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProductRail"])("sale", 1)).length > 0;
    const columns = cols.map((c)=>({
            ...c,
            links: c.links.filter(([label])=>label !== "Sale" || hasSale)
        }));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
        className: "mt-24 border-t border-line bg-cloud/50",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "container-page grid gap-10 py-16 md:grid-cols-12 md:gap-8 [&>*]:min-w-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "md:col-span-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$logo$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Logo"], {}, void 0, false, {
                                fileName: "[project]/src/components/site/footer.tsx",
                                lineNumber: 20,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-4 max-w-xs text-[14.5px] text-ink-soft",
                                children: [
                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].tagline,
                                    " Delivering to all 77 districts of Nepal."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/site/footer.tsx",
                                lineNumber: 21,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-6",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$newsletter$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NewsletterForm"], {}, void 0, false, {
                                    fileName: "[project]/src/components/site/footer.tsx",
                                    lineNumber: 22,
                                    columnNumber: 33
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/site/footer.tsx",
                                lineNumber: 22,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/site/footer.tsx",
                        lineNumber: 19,
                        columnNumber: 9
                    }, this),
                    columns.map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "md:col-span-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted",
                                    children: c.title
                                }, void 0, false, {
                                    fileName: "[project]/src/components/site/footer.tsx",
                                    lineNumber: 26,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                    className: "space-y-2.5 text-[14.5px]",
                                    children: c.links.map(([label, href])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                                href: href,
                                                className: "text-ink-soft hover:text-accent",
                                                children: label
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/site/footer.tsx",
                                                lineNumber: 28,
                                                columnNumber: 62
                                            }, this)
                                        }, href, false, {
                                            fileName: "[project]/src/components/site/footer.tsx",
                                            lineNumber: 28,
                                            columnNumber: 47
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/src/components/site/footer.tsx",
                                    lineNumber: 27,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, c.title, true, {
                            fileName: "[project]/src/components/site/footer.tsx",
                            lineNumber: 25,
                            columnNumber: 11
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "md:col-span-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted",
                                children: "Contact"
                            }, void 0, false, {
                                fileName: "[project]/src/components/site/footer.tsx",
                                lineNumber: 33,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-[14.5px] text-ink-soft",
                                children: [
                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].supportPhone,
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                        fileName: "[project]/src/components/site/footer.tsx",
                                        lineNumber: 34,
                                        columnNumber: 74
                                    }, this),
                                    "WhatsApp ",
                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].supportWhatsApp,
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                        fileName: "[project]/src/components/site/footer.tsx",
                                        lineNumber: 34,
                                        columnNumber: 112
                                    }, this),
                                    "Sun–Fri, 10am–7pm"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/site/footer.tsx",
                                lineNumber: 34,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-2 break-all text-[14.5px] text-ink-soft",
                                children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].supportEmail
                            }, void 0, false, {
                                fileName: "[project]/src/components/site/footer.tsx",
                                lineNumber: 35,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/site/footer.tsx",
                        lineNumber: 32,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/site/footer.tsx",
                lineNumber: 18,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-t border-line",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "container-page flex flex-col gap-3 py-6 text-[13px] text-muted md:flex-row md:items-center md:justify-between",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: [
                                "© ",
                                new Date().getFullYear(),
                                " ",
                                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name,
                                ". All rights reserved."
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/site/footer.tsx",
                            lineNumber: 40,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex gap-5",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/help#privacy",
                                    children: "Privacy"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/site/footer.tsx",
                                    lineNumber: 41,
                                    columnNumber: 39
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/help#terms",
                                    children: "Terms"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/site/footer.tsx",
                                    lineNumber: 41,
                                    columnNumber: 80
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].onlinePaymentsLive ? "eSewa · Khalti · Cash on delivery" : "Cash on delivery"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/site/footer.tsx",
                                    lineNumber: 41,
                                    columnNumber: 117
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/site/footer.tsx",
                            lineNumber: 41,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/site/footer.tsx",
                    lineNumber: 39,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/site/footer.tsx",
                lineNumber: 38,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/site/footer.tsx",
        lineNumber: 17,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/site/header-client.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HeaderActions",
    ()=>HeaderActions,
    "MobileNavButton",
    ()=>MobileNavButton
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const HeaderActions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call HeaderActions() from the server but HeaderActions is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/site/header-client.tsx", "HeaderActions");
const MobileNavButton = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call MobileNavButton() from the server but MobileNavButton is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/site/header-client.tsx", "MobileNavButton");
}),
"[project]/src/components/site/header-client.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$header$2d$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/components/site/header-client.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$header$2d$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/components/site/header.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Header",
    ()=>Header,
    "NavLink",
    ()=>NavLink
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$catalog$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/catalog.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$logo$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/site/logo.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$header$2d$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/site/header-client.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$search$2d$bar$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/site/search-bar.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$mega$2d$nav$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/site/mega-nav.tsx [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
async function Header() {
    const [tree, collections, onSale] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$catalog$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCategoryTree"])(),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$catalog$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCollections"])(),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$catalog$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getProductRail"])("sale", 1)
    ]);
    const hasSale = onSale.length > 0; // no "Sale" link to an empty page
    const nav = tree.map((c)=>({
            name: c.name,
            slug: c.slug,
            image: c.image,
            children: c.children.map((x)=>({
                    name: x.name,
                    slug: x.slug
                }))
        }));
    const featured = collections.filter((c)=>c.featured).map((c)=>({
            name: c.name,
            slug: c.slug,
            image: c.image
        }));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-ink text-white",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "container-page flex h-9 items-center justify-center gap-6 text-[12.5px] tracking-wide",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: [
                                "Free delivery over ",
                                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["formatPrice"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].shipping.freeThreshold)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/site/header.tsx",
                            lineNumber: 20,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "hidden sm:inline text-white/40",
                            children: "·"
                        }, void 0, false, {
                            fileName: "[project]/src/components/site/header.tsx",
                            lineNumber: 21,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "hidden sm:inline",
                            children: [
                                "Easy ",
                                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].returnWindowDays,
                                "-day returns"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/site/header.tsx",
                            lineNumber: 22,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "hidden md:inline text-white/40",
                            children: "·"
                        }, void 0, false, {
                            fileName: "[project]/src/components/site/header.tsx",
                            lineNumber: 23,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "hidden md:inline",
                            children: "Cash on delivery all over Nepal"
                        }, void 0, false, {
                            fileName: "[project]/src/components/site/header.tsx",
                            lineNumber: 24,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/site/header.tsx",
                    lineNumber: 19,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/site/header.tsx",
                lineNumber: 18,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "container-page flex h-16 items-center gap-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$header$2d$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MobileNavButton"], {
                            nav: nav,
                            collections: featured,
                            hasSale: hasSale
                        }, void 0, false, {
                            fileName: "[project]/src/components/site/header.tsx",
                            lineNumber: 29,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$logo$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["Logo"], {
                            className: "shrink-0"
                        }, void 0, false, {
                            fileName: "[project]/src/components/site/header.tsx",
                            lineNumber: 30,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$mega$2d$nav$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["MegaNav"], {
                            nav: nav,
                            collections: featured,
                            hasSale: hasSale
                        }, void 0, false, {
                            fileName: "[project]/src/components/site/header.tsx",
                            lineNumber: 31,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "ml-auto flex flex-1 items-center justify-end gap-1 lg:flex-none",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$search$2d$bar$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SearchBar"], {}, void 0, false, {
                                    fileName: "[project]/src/components/site/header.tsx",
                                    lineNumber: 33,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$header$2d$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["HeaderActions"], {}, void 0, false, {
                                    fileName: "[project]/src/components/site/header.tsx",
                                    lineNumber: 34,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/site/header.tsx",
                            lineNumber: 32,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/site/header.tsx",
                    lineNumber: 28,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/site/header.tsx",
                lineNumber: 27,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/site/header.tsx",
        lineNumber: 17,
        columnNumber: 5
    }, this);
}
function NavLink({ href, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
        href: href,
        className: "text-[14px] font-medium hover:text-accent",
        children: children
    }, void 0, false, {
        fileName: "[project]/src/components/site/header.tsx",
        lineNumber: 43,
        columnNumber: 10
    }, this);
}
}),
"[project]/src/components/site/logo.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Logo",
    ()=>Logo
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-rsc] (ecmascript)");
;
;
;
;
function Logo({ className }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
        href: "/",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cn"])("font-display text-[26px] leading-none tracking-tight", className),
        "aria-label": `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name} home`,
        children: [
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].name.toLowerCase(),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-accent",
                children: "."
            }, void 0, false, {
                fileName: "[project]/src/components/site/logo.tsx",
                lineNumber: 8,
                columnNumber: 33
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/site/logo.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/components/site/mega-nav.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MegaNav",
    ()=>MegaNav
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const MegaNav = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call MegaNav() from the server but MegaNav is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/site/mega-nav.tsx", "MegaNav");
}),
"[project]/src/components/site/mega-nav.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$mega$2d$nav$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/components/site/mega-nav.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$mega$2d$nav$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/components/site/newsletter.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NewsletterForm",
    ()=>NewsletterForm
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const NewsletterForm = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call NewsletterForm() from the server but NewsletterForm is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/site/newsletter.tsx", "NewsletterForm");
}),
"[project]/src/components/site/newsletter.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$newsletter$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/components/site/newsletter.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$newsletter$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/components/site/search-bar.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SearchBar",
    ()=>SearchBar
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const SearchBar = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call SearchBar() from the server but SearchBar is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/site/search-bar.tsx", "SearchBar");
}),
"[project]/src/components/site/search-bar.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$search$2d$bar$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/components/site/search-bar.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$search$2d$bar$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/components/site/shop-provider.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ShopProvider",
    ()=>ShopProvider,
    "useShop",
    ()=>useShop
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const ShopProvider = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call ShopProvider() from the server but ShopProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/site/shop-provider.tsx", "ShopProvider");
const useShop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call useShop() from the server but useShop is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/components/site/shop-provider.tsx", "useShop");
}),
"[project]/src/components/site/shop-provider.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$shop$2d$provider$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/components/site/shop-provider.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$site$2f$shop$2d$provider$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/lib/auth.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createSession",
    ()=>createSession,
    "destroySession",
    ()=>destroySession,
    "getCurrentUser",
    ()=>getCurrentUser,
    "hashPassword",
    ()=>hashPassword,
    "requireAdmin",
    ()=>requireAdmin,
    "requirePermission",
    ()=>requirePermission,
    "requireStaff",
    ()=>requireStaff,
    "requireUser",
    ()=>requireUser,
    "verifyPassword",
    ()=>verifyPassword
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/bcryptjs/index.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$session$2d$token$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/session-token.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$permissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/permissions.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
const hashPassword = (pw)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].hash(pw, 12);
const verifyPassword = (pw, hash)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].compare(pw, hash);
const getCurrentUser = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cache"])(async ()=>{
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    const payload = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$session$2d$token$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["verifySession"])(jar.get(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$session$2d$token$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SESSION_COOKIE"])?.value);
    if (!payload) return null;
    const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].user.findUnique({
        where: {
            id: payload.sub
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            tokenVersion: true
        }
    });
    // tokenVersion lets us revoke every session (password change, staff off-boarding)
    if (!user || user.tokenVersion !== payload.v) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
    };
});
async function createSession(user) {
    const token = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$session$2d$token$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["signSession"])({
        sub: user.id,
        role: user.role,
        v: user.tokenVersion
    });
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    jar.set(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$session$2d$token$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SESSION_COOKIE"], token, {
        httpOnly: true,
        secure: ("TURBOPACK compile-time value", "development") === "production",
        sameSite: "lax",
        path: "/",
        maxAge: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$session$2d$token$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SESSION_MAX_AGE"]
    });
}
async function destroySession() {
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    jar.delete(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$session$2d$token$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SESSION_COOKIE"]);
}
async function requireUser(next = "/account") {
    const user = await getCurrentUser();
    if (!user) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(`/login?next=${encodeURIComponent(next)}`);
    return user;
}
async function requireStaff() {
    const user = await getCurrentUser();
    if (!user) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/login?next=/admin");
    if (user.role === "CUSTOMER") (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])("/");
    return user;
}
async function requireAdmin() {
    const user = await requireStaff();
    if (user.role !== "ADMIN") (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$permissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["homeFor"])(user.role));
    return user;
}
async function requirePermission(p) {
    const user = await requireStaff();
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$permissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["can"])(user.role, p)) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$permissions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["homeFor"])(user.role));
    return user;
}
}),
"[project]/src/lib/cart.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CART_COOKIE",
    ()=>CART_COOKIE,
    "ensureCartId",
    ()=>ensureCartId,
    "getCart",
    ()=>getCart,
    "mergeGuestCart",
    ()=>mergeGuestCart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-rsc] (ecmascript)");
;
;
;
;
;
const CART_COOKIE = "tl_cart";
const cartInclude = {
    items: {
        orderBy: {
            createdAt: "asc"
        },
        include: {
            variant: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            price: true,
                            compareAtPrice: true,
                            status: true,
                            brand: true,
                            images: {
                                orderBy: {
                                    position: "asc"
                                },
                                select: {
                                    url: true,
                                    color: true
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};
const EMPTY = {
    id: null,
    lines: [],
    count: 0,
    subtotal: 0
};
async function findCartId() {
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCurrentUser"])();
    if (user) {
        const c = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cart.findUnique({
            where: {
                userId: user.id
            },
            select: {
                id: true
            }
        });
        return c?.id ?? null;
    }
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    return jar.get(CART_COOKIE)?.value ?? null;
}
const getCart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cache"])(async ()=>{
    const id = await findCartId();
    if (!id) return EMPTY;
    const cart = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cart.findUnique({
        where: {
            id
        },
        include: cartInclude
    });
    if (!cart) return EMPTY;
    const lines = cart.items.map((it)=>{
        const p = it.variant.product;
        const image = p.images.find((i)=>i.color === it.variant.color)?.url ?? p.images[0]?.url ?? "";
        return {
            id: it.id,
            variantId: it.variantId,
            productId: p.id,
            name: p.name,
            brand: p.brand,
            slug: p.slug,
            color: it.variant.color,
            size: it.variant.size,
            image,
            unitPrice: p.price,
            compareAtPrice: p.compareAtPrice,
            quantity: it.quantity,
            stock: it.variant.stock,
            available: p.status === "ACTIVE" && it.variant.stock >= it.quantity
        };
    });
    return {
        id: cart.id,
        lines,
        count: lines.reduce((s, l)=>s + l.quantity, 0),
        subtotal: lines.reduce((s, l)=>s + l.unitPrice * l.quantity, 0)
    };
});
async function ensureCartId() {
    const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCurrentUser"])();
    if (user) {
        const c = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cart.upsert({
            where: {
                userId: user.id
            },
            update: {},
            create: {
                userId: user.id
            },
            select: {
                id: true
            }
        });
        return c.id;
    }
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    const existing = jar.get(CART_COOKIE)?.value;
    if (existing) {
        const c = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cart.findUnique({
            where: {
                id: existing
            },
            select: {
                id: true,
                userId: true
            }
        });
        if (c && !c.userId) return c.id;
    }
    const c = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cart.create({
        data: {},
        select: {
            id: true
        }
    });
    jar.set(CART_COOKIE, c.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 60,
        secure: ("TURBOPACK compile-time value", "development") === "production"
    });
    return c.id;
}
async function mergeGuestCart(userId) {
    const jar = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    const guestId = jar.get(CART_COOKIE)?.value;
    if (!guestId) return;
    const guest = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cart.findUnique({
        where: {
            id: guestId
        },
        include: {
            items: {
                include: {
                    variant: {
                        select: {
                            stock: true
                        }
                    }
                }
            }
        }
    });
    jar.delete(CART_COOKIE);
    if (!guest || guest.userId) return;
    const userCart = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].cart.upsert({
        where: {
            userId
        },
        update: {},
        create: {
            userId
        },
        include: {
            items: true
        }
    });
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].$transaction(async (tx)=>{
        for (const item of guest.items){
            const prev = userCart.items.find((i)=>i.variantId === item.variantId)?.quantity ?? 0;
            const qty = Math.min(prev + item.quantity, item.variant.stock, 10);
            if (qty <= 0) continue;
            await tx.cartItem.upsert({
                where: {
                    cartId_variantId: {
                        cartId: userCart.id,
                        variantId: item.variantId
                    }
                },
                update: {
                    quantity: qty
                },
                create: {
                    cartId: userCart.id,
                    variantId: item.variantId,
                    quantity: qty
                }
            });
        }
        await tx.cart.delete({
            where: {
                id: guest.id
            }
        });
    });
}
}),
"[project]/src/lib/catalog.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PAGE_SIZE",
    ()=>PAGE_SIZE,
    "SORTS",
    ()=>SORTS,
    "cardSelect",
    ()=>cardSelect,
    "getCardsByIds",
    ()=>getCardsByIds,
    "getCategoryBySlug",
    ()=>getCategoryBySlug,
    "getCategoryTree",
    ()=>getCategoryTree,
    "getCollections",
    ()=>getCollections,
    "getFacets",
    ()=>getFacets,
    "getLiveStock",
    ()=>getLiveStock,
    "getLook",
    ()=>getLook,
    "getProduct",
    ()=>getProduct,
    "getProductRail",
    ()=>getProductRail,
    "getRelated",
    ()=>getRelated,
    "getReviews",
    ()=>getReviews,
    "listProducts",
    ()=>listProducts,
    "searchProductIds",
    ()=>searchProductIds,
    "toCard",
    ()=>toCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/cache.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
;
;
;
;
;
const PAGE_SIZE = 24;
const SORTS = [
    {
        id: "featured",
        label: "Featured"
    },
    {
        id: "new",
        label: "Newest"
    },
    {
        id: "best",
        label: "Best selling"
    },
    {
        id: "price-asc",
        label: "Price: low to high"
    },
    {
        id: "price-desc",
        label: "Price: high to low"
    },
    {
        id: "rating",
        label: "Top rated"
    }
];
const getCategoryTree = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_cache"])(async ()=>{
    const all = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].category.findMany({
        orderBy: [
            {
                sortOrder: "asc"
            },
            {
                name: "asc"
            }
        ]
    });
    const byId = new Map(all.map((c)=>[
            c.id,
            {
                ...c,
                children: []
            }
        ]));
    const roots = [];
    for (const c of byId.values()){
        if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).children.push(c);
        else roots.push(c);
    }
    return roots;
}, [
    "category-tree"
], {
    tags: [
        "catalog"
    ],
    revalidate: 3600
});
async function getCategoryBySlug(slug) {
    const tree = await getCategoryTree();
    const flat = tree.flatMap((r)=>[
            r,
            ...r.children.flatMap((c)=>[
                    c,
                    ...c.children
                ])
        ]);
    const node = flat.find((c)=>c.slug === slug);
    if (!node) return null;
    const parent = node.parentId ? flat.find((c)=>c.id === node.parentId) ?? null : null;
    const ids = [
        node.id,
        ...node.children.flatMap((c)=>[
                c.id,
                ...c.children.map((g)=>g.id)
            ])
    ];
    return {
        node,
        parent,
        ids
    };
}
// ---------- Search ----------
const GENDER_WORDS = {
    men: "MEN",
    mens: "MEN",
    man: "MEN",
    male: "MEN",
    boys: "KIDS",
    boy: "KIDS",
    women: "WOMEN",
    womens: "WOMEN",
    woman: "WOMEN",
    ladies: "WOMEN",
    female: "WOMEN",
    kids: "KIDS",
    kid: "KIDS",
    girls: "KIDS",
    girl: "KIDS",
    children: "KIDS"
};
const SYNONYMS = {
    tee: "tshirt",
    tees: "tshirt",
    tshirts: "tshirt",
    pant: "trousers",
    pants: "trousers",
    sweater: "sweater",
    jumper: "sweater",
    denim: "jeans",
    hoody: "hoodie",
    hoodies: "hoodie",
    sari: "saree",
    kurti: "kurta"
};
const getColorNames = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_cache"])(async ()=>(await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].variant.findMany({
        distinct: [
            "color"
        ],
        select: {
            color: true
        }
    })).map((v)=>v.color), [
    "color-names"
], {
    tags: [
        "products"
    ],
    revalidate: 3600
});
async function searchProductIds(q, limit = 500) {
    const raw = q.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, (c)=>c === "-" ? "" : " ").split(/\s+/).filter(Boolean).slice(0, 8);
    if (raw.length === 0) return [];
    const colorNames = await getColorNames();
    const colors = new Set();
    let gender = null;
    const words = [];
    for (const t of raw){
        const matched = colorNames.filter((c)=>c.toLowerCase().split(" ").includes(t) || c.toLowerCase() === t);
        if (matched.length) {
            matched.forEach((c)=>colors.add(c));
            continue;
        }
        if (GENDER_WORDS[t] && raw.length > 1) {
            gender = GENDER_WORDS[t];
            continue;
        }
        words.push(SYNONYMS[t] ?? t);
    }
    if (words.length === 0 && colors.size === 0 && !gender) return [];
    const doc = __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].sql`product_search_doc(p."name", p."brand", p."tags", p."description")`;
    const conds = [
        __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].sql`p.status = 'ACTIVE'`
    ];
    for (const w of words){
        // a word matches by prefix full-text, or fuzzily against the name (handles "hodie", "jens")
        conds.push(__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].sql`(${doc} @@ to_tsquery('simple', ${w + ":*"}) OR ${w} <% p."name")`);
    }
    if (colors.size) conds.push(__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].sql`EXISTS (SELECT 1 FROM "Variant" v WHERE v."productId" = p.id AND v.color IN (${__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].join([
        ...colors
    ])}))`);
    if (gender) conds.push(__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].sql`p.gender::text IN (${__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].join(gender === "KIDS" ? [
        "KIDS"
    ] : [
        gender,
        "UNISEX"
    ])})`);
    const tsq = words.length ? words.map((w)=>`${w}:*`).join(" | ") : "";
    const rankExpr = words.length ? __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].sql`ts_rank(${doc}, to_tsquery('simple', ${tsq})) * 2 + word_similarity(${words.join(" ")}, p."name")` : __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].sql`p."ratingAvg"`;
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].$transaction(async (tx)=>{
        await tx.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', '0.4', true)`;
        return tx.$queryRaw(__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].sql`
      SELECT p.id FROM "Product" p
      WHERE ${__TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["Prisma"].join(conds, " AND ")}
      ORDER BY ${rankExpr} DESC, p."soldCount" DESC
      LIMIT ${limit}
    `);
    });
    return rows.map((r)=>r.id);
}
const cardSelect = {
    id: true,
    name: true,
    slug: true,
    brand: true,
    price: true,
    compareAtPrice: true,
    ratingAvg: true,
    ratingCount: true,
    createdAt: true,
    images: {
        orderBy: {
            position: "asc"
        },
        select: {
            url: true,
            alt: true,
            color: true
        },
        take: 6
    },
    variants: {
        select: {
            id: true,
            color: true,
            colorHex: true,
            size: true,
            stock: true
        },
        orderBy: {
            position: "asc"
        }
    }
};
function toCard(p) {
    const colors = new Map();
    const sizes = new Set();
    let stock = 0;
    for (const v of p.variants){
        if (!colors.has(v.color)) colors.set(v.color, v.colorHex);
        if (v.stock > 0) sizes.add(v.size);
        stock += v.stock;
    }
    return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        isNew: Date.now() - new Date(p.createdAt).getTime() < 1000 * 60 * 60 * 24 * 30,
        images: p.images,
        colors: [
            ...colors
        ].map(([name, hex])=>({
                name,
                hex
            })),
        sizes: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sortSizes"])([
            ...sizes
        ]),
        inStock: stock > 0,
        lowStock: stock > 0 && stock <= 5,
        variants: p.variants.map((v)=>({
                id: v.id,
                color: v.color,
                size: v.size,
                stock: v.stock
            }))
    };
}
async function buildWhere(f, opts = {}) {
    const and = [
        {
            status: "ACTIVE"
        }
    ];
    let searchIds = null;
    if (f.q) {
        searchIds = await searchProductIds(f.q);
        and.push({
            id: {
                in: searchIds
            }
        });
    }
    if (f.category) {
        const c = await getCategoryBySlug(f.category);
        and.push({
            categoryId: {
                in: c ? c.ids : [
                    "__none__"
                ]
            }
        });
    }
    if (f.collection) and.push({
        collections: {
            some: {
                slug: f.collection
            }
        }
    });
    if (f.gender) and.push({
        gender: {
            in: f.gender === "KIDS" ? [
                "KIDS"
            ] : [
                f.gender,
                "UNISEX"
            ]
        }
    });
    if (f.sale) and.push({
        compareAtPrice: {
            not: null
        }
    });
    const ignore = new Set(opts.ignore ?? []);
    if (!ignore.has("brands") && f.brands?.length) and.push({
        brand: {
            in: f.brands
        }
    });
    if (!ignore.has("price")) {
        if (f.minPrice != null) and.push({
            price: {
                gte: f.minPrice
            }
        });
        if (f.maxPrice != null) and.push({
            price: {
                lte: f.maxPrice
            }
        });
    }
    const variantWhere = {};
    if (!ignore.has("sizes") && f.sizes?.length) variantWhere.size = {
        in: f.sizes
    };
    if (!ignore.has("colors") && f.colors?.length) variantWhere.color = {
        in: f.colors
    };
    if (f.inStock || variantWhere.size) variantWhere.stock = {
        gt: 0
    };
    if (Object.keys(variantWhere).length) and.push({
        variants: {
            some: variantWhere
        }
    });
    return {
        where: {
            AND: and
        },
        searchIds
    };
}
function orderFor(sort) {
    switch(sort){
        case "new":
            return [
                {
                    createdAt: "desc"
                }
            ];
        case "best":
            return [
                {
                    soldCount: "desc"
                }
            ];
        case "price-asc":
            return [
                {
                    price: "asc"
                }
            ];
        case "price-desc":
            return [
                {
                    price: "desc"
                }
            ];
        case "rating":
            return [
                {
                    ratingAvg: "desc"
                },
                {
                    ratingCount: "desc"
                }
            ];
        default:
            return [
                {
                    featured: "desc"
                },
                {
                    soldCount: "desc"
                },
                {
                    createdAt: "desc"
                }
            ];
    }
}
async function _listProducts(f) {
    const page = Math.max(1, f.page ?? 1);
    const { where, searchIds } = await buildWhere(f);
    const relevance = searchIds && (!f.sort || f.sort === "relevance");
    const [total, rows] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.count({
            where
        }),
        relevance ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.findMany({
            where,
            select: cardSelect
        }) : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.findMany({
            where,
            select: cardSelect,
            orderBy: [
                ...orderFor(f.sort),
                {
                    id: "asc"
                }
            ],
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE
        })
    ]);
    let products = rows;
    if (relevance) {
        const rank = new Map(searchIds.map((id, i)=>[
                id,
                i
            ]));
        products = [
            ...rows
        ].sort((a, b)=>(rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    }
    return {
        products: products.map(toCard),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / PAGE_SIZE))
    };
}
/** Facets are computed on the broader scope so shoppers can widen a filter, not just narrow it. */ async function _getFacets(f) {
    const { where } = await buildWhere(f, {
        ignore: [
            "sizes",
            "colors",
            "brands",
            "price"
        ]
    });
    const [variants, brands, price] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].variant.findMany({
            where: {
                product: where
            },
            distinct: [
                "color",
                "size"
            ],
            select: {
                color: true,
                colorHex: true,
                size: true
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.groupBy({
            by: [
                "brand"
            ],
            where,
            _count: {
                _all: true
            },
            orderBy: {
                brand: "asc"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.aggregate({
            where,
            _min: {
                price: true
            },
            _max: {
                price: true
            }
        })
    ]);
    const colors = new Map();
    const sizes = new Set();
    for (const v of variants){
        colors.set(v.color, v.colorHex);
        sizes.add(v.size);
    }
    return {
        colors: [
            ...colors
        ].map(([name, hex])=>({
                name,
                hex
            })).sort((a, b)=>a.name.localeCompare(b.name)),
        sizes: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sortSizes"])([
            ...sizes
        ]),
        brands: brands.map((b)=>({
                name: b.brand,
                count: b._count._all
            })),
        priceMin: price._min.price ?? 0,
        priceMax: price._max.price ?? 0
    };
}
const listProducts = (f)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_cache"])(()=>_listProducts(f), [
        "list",
        JSON.stringify(f)
    ], {
        tags: [
            "products"
        ],
        revalidate: 60
    })();
const getFacets = (f)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_cache"])(()=>_getFacets(f), [
        "facets",
        JSON.stringify({
            ...f,
            page: undefined,
            sort: undefined
        })
    ], {
        tags: [
            "products"
        ],
        revalidate: 300
    })();
const getProductRail = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_cache"])(async (kind, take = 8, gender)=>{
    const where = {
        status: "ACTIVE",
        ...gender ? {
            gender: {
                in: [
                    gender,
                    "UNISEX"
                ]
            }
        } : {}
    };
    if (kind === "sale") where.compareAtPrice = {
        not: null
    };
    if (kind === "featured") where.featured = true;
    const orderBy = kind === "new" ? {
        createdAt: "desc"
    } : kind === "sale" ? {
        soldCount: "desc"
    } : {
        soldCount: "desc"
    };
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.findMany({
        where,
        select: cardSelect,
        orderBy: [
            orderBy,
            {
                id: "asc"
            }
        ],
        take
    });
    return rows.map(toCard);
}, [
    "rail"
], {
    tags: [
        "products"
    ],
    revalidate: 300
});
const getProduct = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_cache"])(async (slug)=>{
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.findFirst({
        where: {
            slug,
            status: "ACTIVE"
        },
        include: {
            category: {
                include: {
                    parent: true
                }
            },
            images: {
                orderBy: {
                    position: "asc"
                }
            },
            variants: {
                orderBy: {
                    position: "asc"
                }
            }
        }
    });
}, [
    "product"
], {
    tags: [
        "products"
    ],
    revalidate: 60
});
async function getLiveStock(productId) {
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].variant.findMany({
        where: {
            productId
        },
        select: {
            id: true,
            stock: true
        }
    });
    return Object.fromEntries(rows.map((r)=>[
            r.id,
            r.stock
        ]));
}
const getRelated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_cache"])(async (productId, categoryId, gender)=>{
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.findMany({
        where: {
            status: "ACTIVE",
            id: {
                not: productId
            },
            OR: [
                {
                    categoryId
                },
                {
                    gender
                }
            ]
        },
        select: cardSelect,
        orderBy: [
            {
                soldCount: "desc"
            }
        ],
        take: 24
    });
    // same-category first
    const cat = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.findMany({
        where: {
            id: {
                in: rows.map((r)=>r.id)
            },
            categoryId
        },
        select: {
            id: true
        }
    });
    const inCat = new Set(cat.map((c)=>c.id));
    return rows.sort((a, b)=>Number(inCat.has(b.id)) - Number(inCat.has(a.id))).slice(0, 8).map(toCard);
}, [
    "related"
], {
    tags: [
        "products"
    ],
    revalidate: 600
});
async function getReviews(productId, take = 10) {
    const [reviews, dist, fits] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].review.findMany({
            where: {
                productId,
                status: "PUBLISHED"
            },
            orderBy: {
                createdAt: "desc"
            },
            take,
            include: {
                user: {
                    select: {
                        name: true
                    }
                }
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].review.groupBy({
            by: [
                "rating"
            ],
            where: {
                productId,
                status: "PUBLISHED"
            },
            _count: {
                _all: true
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].review.groupBy({
            by: [
                "fit"
            ],
            where: {
                productId,
                status: "PUBLISHED",
                fit: {
                    not: null
                }
            },
            _count: {
                _all: true
            }
        })
    ]);
    const distribution = [
        5,
        4,
        3,
        2,
        1
    ].map((r)=>({
            rating: r,
            count: dist.find((d)=>d.rating === r)?._count._all ?? 0
        }));
    return {
        reviews,
        distribution,
        fits: fits.map((f)=>({
                fit: f.fit,
                count: f._count._all
            }))
    };
}
const getCollections = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_cache"])(async ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].collection.findMany({
        orderBy: [
            {
                featured: "desc"
            },
            {
                sortOrder: "asc"
            }
        ]
    }), [
    "collections"
], {
    tags: [
        "catalog"
    ],
    revalidate: 3600
});
const getLook = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$cache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["unstable_cache"])(async (productId)=>{
    const live = {
        status: "ACTIVE"
    };
    const p = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.findUnique({
        where: {
            id: productId
        },
        select: {
            pairsWith: {
                where: live,
                select: cardSelect
            },
            pairedBy: {
                where: live,
                select: cardSelect
            }
        }
    });
    if (!p) return [];
    const all = [
        ...new Map([
            ...p.pairsWith,
            ...p.pairedBy
        ].map((x)=>[
                x.id,
                x
            ])).values()
    ].map(toCard);
    return all.sort((a, b)=>Number(b.inStock) - Number(a.inStock)).slice(0, 8);
}, [
    "look"
], {
    tags: [
        "products"
    ],
    revalidate: 600
});
async function getCardsByIds(ids) {
    if (!ids.length) return [];
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].product.findMany({
        where: {
            id: {
                in: ids
            },
            status: "ACTIVE"
        },
        select: cardSelect
    });
    const byId = new Map(rows.map((r)=>[
            r.id,
            toCard(r)
        ]));
    return ids.flatMap((id)=>byId.get(id) ?? []);
}
}),
"[project]/src/lib/db.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
/**
 * Connection pool per app instance: DB_POOL_SIZE (default 20) unless the URL already sets
 * `connection_limit`. Prisma's own default (2 × CPU cores + 1) is too small on little servers.
 * Behind PgBouncer, keep it at or below what the bouncer allows per instance.
 * PRISMA_LOG=query prints every SQL statement (debugging only — never leave on in production).
 */ function databaseUrl() {
    const raw = process.env.DATABASE_URL;
    if (!raw) return undefined;
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", process.env.DB_POOL_SIZE ?? "20");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
}
// Reuse a single client across hot reloads in development.
const globalForPrisma = globalThis;
const db = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    // no URL at build time (CI bundles are built without a database): let Prisma read the env when it first connects
    ...databaseUrl() ? {
        datasources: {
            db: {
                url: databaseUrl()
            }
        }
    } : {},
    log: process.env.PRISMA_LOG === "query" ? [
        "query",
        "warn",
        "error"
    ] : ("TURBOPACK compile-time truthy", 1) ? [
        "warn",
        "error"
    ] : "TURBOPACK unreachable"
});
if ("TURBOPACK compile-time truthy", 1) globalForPrisma.prisma = db;
}),
"[project]/src/lib/permissions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Client-safe role → permission map. The ONLY place that decides who can do what.
// Segregation of duties (from the owner's operating rules):
//   Cashier  sells and takes payment; can't change prices, stock or history.
//   Staff    fulfils online orders.
//   Manager  approves discounts ≤ 15%, adjusts stock, closes the day.
//   Owner    (ADMIN) everything, incl. prices, costs & profit, delivery rates, roles and large discounts.
//   Returns always need a manager or owner (cashiers ask for a PIN on the till).
__turbopack_context__.s([
    "ROLE_LABEL",
    ()=>ROLE_LABEL,
    "can",
    ()=>can,
    "discountLimitPercent",
    ()=>discountLimitPercent,
    "homeFor",
    ()=>homeFor,
    "isStaffRole",
    ()=>isStaffRole
]);
const MAP = {
    CASHIER: [
        "pos.sell",
        "catalog.view"
    ],
    STAFF: [
        "dashboard",
        "orders",
        "catalog.view",
        "reviews"
    ],
    MANAGER: [
        "dashboard",
        "orders",
        "catalog.view",
        "inventory.adjust",
        "customers",
        "reviews",
        "pos.sell",
        "closing",
        "approve.discount",
        "approve.return",
        "purchasing"
    ],
    ADMIN: [
        "dashboard",
        "orders",
        "catalog.view",
        "catalog.edit",
        "inventory.adjust",
        "customers",
        "team.manage",
        "coupons",
        "delivery",
        "reviews",
        "pos.sell",
        "closing",
        "approve.discount",
        "approve.return",
        "purchasing",
        "finance"
    ]
};
const ROLE_LABEL = {
    CUSTOMER: "Customer",
    CASHIER: "Cashier",
    STAFF: "Fulfilment staff",
    MANAGER: "Manager",
    ADMIN: "Owner"
};
function can(role, p) {
    if (!role || role === "CUSTOMER") return false;
    return MAP[role].includes(p);
}
const isStaffRole = (role)=>!!role && role !== "CUSTOMER";
function discountLimitPercent(role) {
    return role === "ADMIN" ? 100 : role === "MANAGER" ? 15 : role === "CASHIER" ? 5 : 0;
}
function homeFor(role) {
    return role === "CASHIER" ? "/admin/pos" : "/admin";
}
}),
"[project]/src/lib/session-token.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SESSION_COOKIE",
    ()=>SESSION_COOKIE,
    "SESSION_MAX_AGE",
    ()=>SESSION_MAX_AGE,
    "signSession",
    ()=>signSession,
    "verifySession",
    ()=>verifySession
]);
// Edge-safe JWT helpers (used by both proxy.ts and server code).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$sign$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/sign.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/verify.js [app-rsc] (ecmascript)");
;
const SESSION_COOKIE = "tl_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
function key() {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
    return new TextEncoder().encode(secret);
}
async function signSession(payload) {
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$sign$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SignJWT"](payload).setProtectedHeader({
        alg: "HS256"
    }).setIssuedAt().setExpirationTime(`${SESSION_MAX_AGE}s`).sign(key());
}
async function verifySession(token) {
    if (!token) return null;
    try {
        const { payload } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jwtVerify"])(token, key(), {
            algorithms: [
                "HS256"
            ]
        });
        return payload;
    } catch  {
        return null;
    }
}
}),
"[project]/src/lib/utils.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addressLines",
    ()=>addressLines,
    "cn",
    ()=>cn,
    "discountPercent",
    ()=>discountPercent,
    "formatDate",
    ()=>formatDate,
    "formatDateTime",
    ()=>formatDateTime,
    "formatNumber",
    ()=>formatNumber,
    "formatOrderNumber",
    ()=>formatOrderNumber,
    "formatPrice",
    ()=>formatPrice,
    "formatShortDate",
    ()=>formatShortDate,
    "img",
    ()=>img,
    "now",
    ()=>now,
    "parseOrderNumber",
    ()=>parseOrderNumber,
    "slugify",
    ()=>slugify,
    "sp",
    ()=>sp,
    "spList",
    ()=>spList
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/config.ts [app-rsc] (ecmascript)");
;
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
const numberFormatter = new Intl.NumberFormat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].numberLocale, {
    maximumFractionDigits: 0
});
function formatPrice(paisa) {
    const n = Math.round(paisa) / 100;
    return `${n < 0 ? "-" : ""}${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].currencySymbol} ${numberFormatter.format(Math.abs(n))}`;
}
function formatNumber(n) {
    return numberFormatter.format(n);
}
function discountPercent(price, compareAt) {
    if (!compareAt || compareAt <= price) return 0;
    return Math.round((compareAt - price) / compareAt * 100);
}
function formatOrderNumber(n) {
    return `${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].orderPrefix}${String(n).padStart(6, "0")}`;
}
function parseOrderNumber(s) {
    const m = s.trim().toUpperCase().replace(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].orderPrefix, "").replace(/^#/, "");
    const n = Number.parseInt(m, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}
function addressLines(a) {
    if (!a?.line1) return []; // store sales have no delivery address
    const place = [
        a.city,
        a.district && a.district !== a.city ? a.district : null
    ].filter(Boolean).join(", ");
    return [
        [
            a.line1,
            a.line2
        ].filter(Boolean).join(", "),
        place,
        `${a.state} Province${a.postalCode ? ` ${a.postalCode}` : ""}`
    ].filter(Boolean);
}
function slugify(s) {
    return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
const dateFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].timeZone
});
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].timeZone
});
const shortDateFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$config$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["store"].timeZone
});
const formatShortDate = (d)=>shortDateFmt.format(new Date(d));
const formatDate = (d)=>dateFmt.format(new Date(d));
const formatDateTime = (d)=>dateTimeFmt.format(new Date(d));
const now = ()=>Date.now();
function sp(v) {
    return Array.isArray(v) ? v[0] : v;
}
function spList(v) {
    if (!v) return [];
    return (Array.isArray(v) ? v : v.split(",")).flatMap((x)=>x.split(",")).filter(Boolean);
}
function img(url, w) {
    if (url.includes("images.unsplash.com")) {
        const u = new URL(url);
        u.searchParams.set("w", String(w));
        u.searchParams.set("q", "75");
        u.searchParams.set("auto", "format");
        u.searchParams.set("fit", "crop");
        return u.toString();
    }
    return url;
}
}),
];

//# sourceMappingURL=src_0b94-pwx59-9x._.js.map