export const punyaIzinHdu = (permissions, module, submodule, action, feature) => {
    const modul = permissions.find((m) => m.module === module && m.checked !== false);
    const sub = (modul?.subModules ?? modul?.submodules ?? []).find((s) => s.name === submodule && s.checked !== false);
    const node = feature ? sub?.features?.find((s) => s.name === feature && s.checked !== false) : sub;
    return (node?.allows ?? []).some((a) => typeof a === "string" ? a === action : a.name === action && a.checked !== false);
};
