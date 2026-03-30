"use client";

import { useState, useMemo } from "react";
import {
  HELP_CATEGORIES,
  HELP_ARTICLES,
  searchArticles,
  HelpCategory,
  HelpArticle,
} from "@/lib/help-data";
import {
  Rocket,
  Users,
  MapPin,
  Cog,
  FileCheck,
  PackageCheck,
  ClipboardList,
  CalendarCheck,
  FileText,
  Receipt,
  Clock,
  Wrench,
  BarChart3,
  BookOpen,
  Globe,
  Smartphone,
  Settings,
  Search,
  Lightbulb,
  ArrowLeft,
  ChevronRight,
  Calculator,
  Brain,
  TrendingUp,
  FileSpreadsheet,
  PlayCircle,
} from "lucide-react";
import "./help.css";

/* ------------------------------------------------------------------ */
/*  Icon mapping: category id -> Lucide component                     */
/* ------------------------------------------------------------------ */
const categoryIconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  "training-videos": PlayCircle,
  "getting-started": Rocket,
  customers: Users,
  sites: MapPin,
  assets: Cog,
  procedures: FileCheck,
  standards: PackageCheck,
  "work-orders": ClipboardList,
  visits: CalendarCheck,
  quotes: FileText,
  invoices: Receipt,
  "pm-schedules": Clock,
  materials: Wrench,
  reports: BarChart3,
  "knowledge-base": BookOpen,
  "portal-customer": Globe,
  "portal-tech": Smartphone,
  settings: Settings,
  "global-search": Search,
  tips: Lightbulb,
  "qbo-integration": Calculator,
  "ai-features": Brain,
  "crm-sales": TrendingUp,
  "custom-reports": FileSpreadsheet,
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type View = "home" | "category" | "article";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function HelpCenterPage() {
  const [view, setView] = useState<View>("home");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  /* ---------- derived data ---------- */
  const selectedCategory: HelpCategory | undefined = useMemo(
    () => HELP_CATEGORIES.find((c) => c.id === selectedCategoryId),
    [selectedCategoryId],
  );

  const selectedArticle: HelpArticle | undefined = useMemo(
    () => HELP_ARTICLES.find((a) => a.id === selectedArticleId),
    [selectedArticleId],
  );

  const categoryArticles: HelpArticle[] = useMemo(
    () => HELP_ARTICLES.filter((a) => a.categoryId === selectedCategoryId),
    [selectedCategoryId],
  );

  const searchResults: HelpArticle[] = useMemo(() => {
    if (searchQuery.length < 2) return [];
    return searchArticles(searchQuery);
  }, [searchQuery]);

  /* ---------- navigation helpers ---------- */
  const goHome = () => {
    setView("home");
    setSelectedCategoryId(null);
    setSelectedArticleId(null);
    setSearchQuery("");
  };

  const goToCategory = (categoryId: string) => {
    setView("category");
    setSelectedCategoryId(categoryId);
    setSelectedArticleId(null);
    setSearchQuery("");
  };

  const goToArticle = (article: HelpArticle) => {
    setView("article");
    setSelectedCategoryId(article.categoryId);
    setSelectedArticleId(article.id);
    setSearchQuery("");
  };

  /* ---------- helper: get category name by id ---------- */
  const getCategoryName = (categoryId: string): string => {
    const cat = HELP_CATEGORIES.find((c) => c.id === categoryId);
    return cat ? cat.title : categoryId;
  };

  /* ---------- helper: count articles per category ---------- */
  const articleCountMap: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of HELP_ARTICLES) {
      counts[a.categoryId] = (counts[a.categoryId] || 0) + 1;
    }
    return counts;
  }, []);

  /* ---------- helper: resolve related articles ---------- */
  const relatedArticles: HelpArticle[] = useMemo(() => {
    if (!selectedArticle?.relatedArticleIds) return [];
    return selectedArticle.relatedArticleIds
      .map((id) => HELP_ARTICLES.find((a) => a.id === id))
      .filter((a): a is HelpArticle => !!a);
  }, [selectedArticle]);

  /* ================================================================ */
  /*  RENDER: Home view                                               */
  /* ================================================================ */
  const renderHome = () => (
    <>
      {/* Header */}
      <div className="help-header">
        <h1 className="help-title">Help Center</h1>
        <p className="help-subtitle">
          Find answers to common questions about ServiceOpsIQ
        </p>
      </div>

      {/* Search */}
      <div className="help-search-wrapper">
        <Search className="help-search-icon" size={18} />
        <input
          type="text"
          className="help-search-input"
          placeholder="Search help articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Search results overlay */}
        {searchQuery.length >= 2 && (
          <div className="help-search-results">
            {searchResults.length === 0 ? (
              <div className="help-no-results">
                No articles found for &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              searchResults.map((article) => (
                <button
                  key={article.id}
                  className="help-search-result"
                  onClick={() => goToArticle(article)}
                  type="button"
                >
                  <div className="help-search-result-title">{article.title}</div>
                  <div className="help-search-result-category">
                    {getCategoryName(article.categoryId)}
                  </div>
                  {article.summary && (
                    <div className="help-search-result-summary">
                      {article.summary}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Category grid */}
      <div className="help-categories">
        {HELP_CATEGORIES.map((cat) => {
          const IconComponent = categoryIconMap[cat.id];
          return (
            <button
              key={cat.id}
              className="help-category-card"
              onClick={() => goToCategory(cat.id)}
              type="button"
            >
              <div className="help-category-icon">
                {IconComponent ? <IconComponent size={22} /> : <Search size={22} />}
              </div>
              <h3 className="help-category-title">{cat.title}</h3>
              <p className="help-category-desc">{cat.description}</p>
              <span className="help-category-count">
                {articleCountMap[cat.id] || 0}{" "}
                {(articleCountMap[cat.id] || 0) === 1 ? "article" : "articles"}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );

  /* ================================================================ */
  /*  RENDER: Category view                                           */
  /* ================================================================ */
  const renderCategory = () => {
    if (!selectedCategory) return null;

    return (
      <>
        {/* Breadcrumbs */}
        <nav className="help-breadcrumbs" aria-label="Breadcrumb">
          <button
            className="help-breadcrumb-link"
            onClick={goHome}
            type="button"
          >
            Help Center
          </button>
          <span className="help-breadcrumb-sep">/</span>
          <span className="help-breadcrumb-current">
            {selectedCategory.title}
          </span>
        </nav>

        {/* Back button */}
        <button className="help-back" onClick={goHome} type="button">
          <ArrowLeft size={16} />
          Back to Help Center
        </button>

        {/* Category header */}
        <div className="help-header">
          <h1 className="help-title">{selectedCategory.title}</h1>
          <p className="help-subtitle">{selectedCategory.description}</p>
        </div>

        {/* Article list */}
        <div className="help-article-list">
          {categoryArticles.length === 0 ? (
            <div className="help-no-results">
              No articles in this category yet.
            </div>
          ) : (
            categoryArticles.map((article) => (
              <button
                key={article.id}
                className="help-article-card"
                onClick={() => goToArticle(article)}
                type="button"
              >
                <div>
                  <h3 className="help-article-card-title">{article.title}</h3>
                  {article.summary && (
                    <p className="help-article-card-summary">
                      {article.summary}
                    </p>
                  )}
                </div>
                <ChevronRight className="help-article-arrow" size={20} />
              </button>
            ))
          )}
        </div>
      </>
    );
  };

  /* ================================================================ */
  /*  RENDER: Article view                                            */
  /* ================================================================ */
  const renderArticle = () => {
    if (!selectedArticle || !selectedCategory) return null;

    return (
      <>
        {/* Breadcrumbs */}
        <nav className="help-breadcrumbs" aria-label="Breadcrumb">
          <button
            className="help-breadcrumb-link"
            onClick={goHome}
            type="button"
          >
            Help Center
          </button>
          <span className="help-breadcrumb-sep">/</span>
          <button
            className="help-breadcrumb-link"
            onClick={() => goToCategory(selectedCategory.id)}
            type="button"
          >
            {selectedCategory.title}
          </button>
          <span className="help-breadcrumb-sep">/</span>
          <span className="help-breadcrumb-current">
            {selectedArticle.title}
          </span>
        </nav>

        {/* Back button */}
        <button
          className="help-back"
          onClick={() => goToCategory(selectedCategory.id)}
          type="button"
        >
          <ArrowLeft size={16} />
          Back to {selectedCategory.title}
        </button>

        {/* Article content */}
        <div className="help-article">
          <h1 className="help-article-title">{selectedArticle.title}</h1>

          {/* Content paragraphs */}
          {selectedArticle.content && (
            <div className="help-article-content">
              {selectedArticle.content.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          )}

          {/* Video link */}
          {selectedArticle.videoUrl && (
            <div className="help-video-link">
              <a
                href={selectedArticle.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="help-video-button"
              >
                <PlayCircle size={20} />
                Watch Training Video
              </a>
            </div>
          )}

          {/* Steps section */}
          {selectedArticle.steps && selectedArticle.steps.length > 0 && (
            <div className="help-steps">
              <h2 className="help-steps-heading">Steps</h2>
              {selectedArticle.steps.map((step, idx) => (
                <div key={idx} className="help-step">
                  <div className="help-step-number">{idx + 1}</div>
                  <div className="help-step-content">
                    <h4 className="help-step-title">{step.title}</h4>
                    <p className="help-step-desc">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tips section */}
          {selectedArticle.tips && selectedArticle.tips.length > 0 && (
            <div className="help-tips">
              <h2 className="help-tips-heading">
                <Lightbulb size={18} style={{ marginRight: 6, verticalAlign: "text-bottom" }} />
                Tips
              </h2>
              {selectedArticle.tips.map((tip, idx) => (
                <div key={idx} className="help-tip">
                  {tip}
                </div>
              ))}
            </div>
          )}

          {/* Related articles */}
          {relatedArticles.length > 0 && (
            <div className="help-related">
              <h2 className="help-related-heading">Related Articles</h2>
              <div className="help-related-list">
                {relatedArticles.map((related) => (
                  <button
                    key={related.id}
                    className="help-related-link"
                    onClick={() => goToArticle(related)}
                    type="button"
                  >
                    {related.title}
                    <span style={{ color: "#9ca3af", fontWeight: 400, marginLeft: 8 }}>
                      ({getCategoryName(related.categoryId)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  /* ================================================================ */
  /*  MAIN RENDER                                                     */
  /* ================================================================ */
  return (
    <div className="help-page">
      {view === "home" && renderHome()}
      {view === "category" && renderCategory()}
      {view === "article" && renderArticle()}
    </div>
  );
}
