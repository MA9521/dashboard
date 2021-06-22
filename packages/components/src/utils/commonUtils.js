const scrollRegex = /(auto|scroll)/;

function convertRemToPixels(rem) {    
    return rem * parseFloat(getStyle(document.documentElement,"font-size"));
}

function getScrollableParent(el, includeHorizontalScroll = false) {
    return !el || el === document.body
        ? document.body : isElementScrollable(el, includeHorizontalScroll) ?
            el : getScrollableParent(el.parentElement);
}

function getStyle(el, prop) {
    if (!el) {
        return "";
    }
    return window.getComputedStyle(el, null).getPropertyValue(prop);
}

function hasElementPositiveScrollBottom(el) {
    if ( !el || !isElementScrollable(el)) {
        return false;
    }
    return el.scrollHeight - el.clientHeight > el.scrollTop;
}

function isElementScrollable(el, includeHorizontalScroll = false) {
    if (!el) {
        return false;
    }
    const horizontalScroll = includeHorizontalScroll ? "" : getStyle(el, "overflow-x");
    return scrollRegex.test(
        getStyle(el, "overflow") +
        getStyle(el, "overflow-y") + horizontalScroll);
}

function onKeyPress(event, callback, desiredKeys = []) {
    if (desiredKeys.length === 0) {
        callback();
    } else if (desiredKeys.includes(event.key)) {
        callback();
    }
}

module.exports = {
    convertRemToPixels,
    getScrollableParent,
    getStyle,
    hasElementPositiveScrollBottom,
    isElementScrollable,
    onKeyPress
};