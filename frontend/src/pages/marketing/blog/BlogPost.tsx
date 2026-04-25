import { Navigate, useParams } from "react-router-dom";
import { BlogPost } from "@/components/page-templates/blog-layout";
import { posts } from "@/data/blogPosts";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = posts.find((p) => p.slug === slug);
  if (!post) return <Navigate to="/blog" replace />;
  return <BlogPost {...post} />;
}
