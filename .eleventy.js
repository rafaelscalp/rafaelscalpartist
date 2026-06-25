module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("imagenes");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.ignores.add("index.html");
  eleventyConfig.addPassthroughCopy("index.html");

  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("blog/posts/*.md").reverse();
  });

  return {
    dir: {
      output: "_site",
      includes: "_includes"
    }
  };
};
