module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("imagenes");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.ignores.add("index.html");
  eleventyConfig.addPassthroughCopy("index.html");

  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("blog/posts/*.md").reverse();
  });

  eleventyConfig.addFilter("fechaCorta", function(date) {
    const d = new Date(date);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  });

  return {
    dir: {
      output: "_site",
      includes: "_includes"
    }
  };
};
