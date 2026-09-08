import { useMemo } from 'react';

import HtmlPreview from '../HtmlPreview';
import { compileBuilderHtml } from '../../../data/builderCompiler';
import { fillDynamicPreview } from '../../../data/dynamicFields';

/** Poora compiled email — HtmlPreview (sandboxed iframe) reuse karta hai, jaisa Custom editor karta hai. */
export default function BuilderDevicePreview({ schema, dynamicFields, device }) {
  const html = useMemo(() => fillDynamicPreview(compileBuilderHtml(schema), dynamicFields), [schema, dynamicFields]);
  return <HtmlPreview html={html} device={device} />;
}
