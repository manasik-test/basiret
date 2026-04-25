import { BlogIndex } from "@/components/page-templates/blog-layout";
import { posts } from "@/data/blogPosts";

export default function BlogIndexPage() {
  return <BlogIndex posts={posts} />;
}
