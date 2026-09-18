// Test adapter only: NOT an implementation of the Bedrock engine or its schemas.
export async function resolve(specifier,context,nextResolve){
 if(specifier==='@minecraft/server-ui')return {url:new URL('./mock-forms.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier==='@minecraft/server')return {url:new URL('./mock-minecraft.mjs',import.meta.url).href,shortCircuit:true};
 return nextResolve(specifier,context);
}
