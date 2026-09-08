#r "nuget: DocumentFormat.OpenXml, 3.2.0"

using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

using WpPageSize = DocumentFormat.OpenXml.Wordprocessing.PageSize;

var outputPath = "/Users/lucent/PycharmProjects/Where-To-Eat-/WhereToEat_推广文档.docx";

using (var doc = WordprocessingDocument.Create(outputPath, WordprocessingDocumentType.Document))
{
var mainPart = doc.AddMainDocumentPart();
mainPart.Document = new Document(new Body());
var body = mainPart.Document.Body!;

// Styles
var stylesPart = mainPart.AddNewPart<StyleDefinitionsPart>();
stylesPart.Styles = new Styles();
var styles = stylesPart.Styles;

styles.Append(new DocDefaults(
    new RunPropertiesDefault(
        new RunPropertiesBaseStyle(
            new RunFonts
            {
                Ascii = "Calibri",
                HighAnsi = "Calibri",
                EastAsia = "Microsoft YaHei",
                ComplexScript = "Calibri"
            },
            new FontSize { Val = "22" },
            new FontSizeComplexScript { Val = "22" },
            new Color { Val = "333333" },
            new Languages { Val = "en-US", EastAsia = "zh-CN" }
        )
    ),
    new ParagraphPropertiesDefault(
        new ParagraphPropertiesBaseStyle(
            new SpacingBetweenLines
            {
                Line = "276",
                LineRule = LineSpacingRuleValues.Auto,
                After = "160"
            }
        )
    )
));

styles.Append(new Style(
    new StyleName { Val = "Normal" },
    new UIPriority { Val = 0 },
    new PrimaryStyle()
) { Type = StyleValues.Paragraph, StyleId = "Normal", Default = true });

styles.Append(CreateHeadingStyle(1, "Microsoft YaHei", "44", "1F3864", false, "480", "120"));
styles.Append(CreateHeadingStyle(2, "Microsoft YaHei", "32", "1F3864", false, "360", "80"));
styles.Append(CreateHeadingStyle(3, "Microsoft YaHei", "28", "1F3864", true, "240", "80"));

var titleStyle = new Style(
    new StyleName { Val = "Title" },
    new BasedOn { Val = "Normal" },
    new UIPriority { Val = 10 },
    new PrimaryStyle(),
    new StyleParagraphProperties(
        new Justification { Val = JustificationValues.Center },
        new SpacingBetweenLines { Before = "600", After = "200" }
    ),
    new StyleRunProperties(
        new RunFonts { EastAsia = "Microsoft YaHei", Ascii = "Calibri", HighAnsi = "Calibri" },
        new FontSize { Val = "72" },
        new FontSizeComplexScript { Val = "72" },
        new Color { Val = "1F3864" },
        new Bold()
    )
) { Type = StyleValues.Paragraph, StyleId = "Title" };
styles.Append(titleStyle);

var subtitleStyle = new Style(
    new StyleName { Val = "Subtitle" },
    new BasedOn { Val = "Normal" },
    new UIPriority { Val = 11 },
    new PrimaryStyle(),
    new StyleParagraphProperties(
        new Justification { Val = JustificationValues.Center },
        new SpacingBetweenLines { After = "400" }
    ),
    new StyleRunProperties(
        new RunFonts { EastAsia = "Microsoft YaHei", Ascii = "Calibri", HighAnsi = "Calibri" },
        new FontSize { Val = "28" },
        new FontSizeComplexScript { Val = "28" },
        new Color { Val = "595959" }
    )
) { Type = StyleValues.Paragraph, StyleId = "Subtitle" };
styles.Append(subtitleStyle);

var sectPr = new SectionProperties(
    new WpPageSize { Width = 11906U, Height = 16838U },
    new PageMargin
    {
        Top = 1440, Bottom = 1440,
        Left = 1440U, Right = 1440U,
        Header = 720U, Footer = 720U, Gutter = 0U
    }
);

AddPageNumberFooter(mainPart, sectPr);

// Content
AddParagraph(body, "Where To Eat", "Title");
AddParagraph(body, "校园餐厅真实评论平台", "Subtitle");

body.Append(new Paragraph(
    new ParagraphProperties(
        new Justification { Val = JustificationValues.Center },
        new ParagraphBorders(
            new BottomBorder { Val = BorderValues.Single, Size = 12, Space = 1, Color = "1F3864" }
        )
    )
));

AddParagraph(body, "", "Normal");

AddParagraph(body, "产品介绍", "Heading1");
AddParagraph(body, "Where To Eat 是一个专为大学生打造的校园餐厅真实评论平台。我们深知，每天中午和傍晚，“今天吃什么”是困扰无数学生的难题。传统的美食推荐平台信息繁杂，难以找到针对校园周边餐厅的真实评价。", "Normal");

AddParagraph(body, "我们的核心理念是：不告诉你附近有什么吃的，而是告诉你学校附近这家店，最近大家到底怎么说。", "Normal");

AddParagraph(body, "核心功能", "Heading1");

AddParagraph(body, "真实评论系统", "Heading2");
AddParagraph(body, "用户可以在店铺详情页直接提交真实评论，选择口语化态度档位，填写一句真实感受。提交后评论立即出现在该店的评论区，形成真实的校园美食社区。", "Normal");

AddParagraph(body, "智能推荐榜单", "Heading2");
AddParagraph(body, "基于真实用户评论和评分，系统自动生成校园周边餐厅推荐榜单，帮助学生快速发现好评餐厅，避开踩雷店铺。", "Normal");

AddParagraph(body, "地图视图", "Heading2");
AddParagraph(body, "集成高德地图，直观展示校园周边餐厅分布。支持按距离、评分、菜系等多维度筛选，让学生一目了然找到心仪的美食。", "Normal");

AddParagraph(body, "评论导入管理", "Heading2");
AddParagraph(body, "支持通过 JSON / CSV 文件批量导入历史评论，方便运营团队快速丰富平台内容。管理员可在后台管理评论的显示状态。", "Normal");

AddParagraph(body, "目标用户", "Heading1");

body.Append(CreateFeatureTable(
    new[] { "用户群体", "使用场景", "核心价值" },
    new[]
    {
        new[] { "在校大学生", "日常用餐决策", "获取同学真实评价，告别选择困难" },
        new[] { "校园美食爱好者", "探索周边美食", "发现隐藏好店，分享美食心得" },
        new[] { "学生社团/组织", "聚餐地点选择", "参考集体评价，选择合适聚餐场所" },
        new[] { "校园运营团队", "平台内容管理", "高效导入评论，维护社区生态" }
    }
));

AddParagraph(body, "产品优势", "Heading1");

AddParagraph(body, "真实可靠", "Heading2");
AddParagraph(body, "所有评论均来自真实用户，系统支持评论审核机制，管理员可隐藏或恢复评论，确保信息质量。", "Normal");

AddParagraph(body, "即时更新", "Heading2");
AddParagraph(body, "用户提交评论后立即生效，餐厅评分和评论概况实时更新，保持信息的时效性。", "Normal");

AddParagraph(body, "操作简便", "Heading2");
AddParagraph(body, "简洁直观的界面设计，用户无需复杂操作即可完成评论提交。支持多种数据导入方式，降低运营门槛。", "Normal");

AddParagraph(body, "本地化部署", "Heading2");
AddParagraph(body, "基于轻量级技术栈，支持快速部署和本地运行，适合校园环境的小规模试运行。", "Normal");

AddParagraph(body, "技术架构", "Heading1");

body.Append(CreateFeatureTable(
    new[] { "技术层", "技术选型", "特点" },
    new[]
    {
        new[] { "后端框架", "FastAPI", "高性能、自动文档生成" },
        new[] { "前端方案", "静态页面", "轻量、易维护" },
        new[] { "数据存储", "SQLite", "零配置、适合原型" },
        new[] { "地图服务", "高德地图 API", "精准定位、丰富 POI" },
        new[] { "包管理", "uv", "快速依赖管理" }
    }
));

AddParagraph(body, "典型使用场景", "Heading1");

AddParagraph(body, "场景一：午餐选择困难", "Heading3");
AddParagraph(body, "小明下课后打开 Where To Eat，查看附近餐厅的推荐榜单，发现同学普遍推荐学苑餐厅的红烧肉，果断前往，果然不踩雷。", "Normal");

AddParagraph(body, "场景二：社团聚餐决策", "Heading3");
AddParagraph(body, "学生会需要组织聚餐，通过地图视图筛选适合 20 人聚餐的餐厅，参考真实评论选择了一家评分高、环境好的火锅店。", "Normal");

AddParagraph(body, "场景三：运营内容补充", "Heading3");
AddParagraph(body, "校园运营团队收集了同学们的历史评论，通过 CSV 批量导入功能快速丰富平台内容，提升了推荐的准确性。", "Normal");

AddParagraph(body, "快速开始", "Heading1");

AddParagraph(body, "环境配置", "Heading2");
AddParagraph(body, "项目使用 uv 管理依赖，执行以下命令即可完成环境搭建：", "Normal");

body.Append(CreateCodeBlock("cd Where-To-Eat-\nuv sync"));

AddParagraph(body, "初始化演示数据", "Heading2");
AddParagraph(body, "首次启动前，建议执行演示数据初始化脚本：", "Normal");

body.Append(CreateCodeBlock("uv run python scripts/bootstrap_demo.py"));

AddParagraph(body, "启动服务", "Heading2");
AddParagraph(body, "运行以下命令启动开发服务器：", "Normal");

body.Append(CreateCodeBlock("uv run uvicorn app.main:app --reload"));

AddParagraph(body, "启动后可访问以下页面：", "Normal");

body.Append(CreateFeatureTable(
    new[] { "路径", "功能" },
    new[]
    {
        new[] { "/", "首页筛选与推荐" },
        new[] { "/recommendations", "推荐榜单" },
        new[] { "/map-view", "地图视图" },
        new[] { "/restaurant-view?id=xxx", "店铺详情" },
        new[] { "/admin", "后台管理" },
        new[] { "/docs", "API 文档" }
    }
));

AddParagraph(body, "联系与支持", "Heading1");
AddParagraph(body, "如需了解更多信息或获取技术支持，请通过以下方式联系我们：", "Normal");

AddParagraph(body, "项目仓库：github.com/Arcdiverrr/Where-To-Eat-", "Normal");
AddParagraph(body, "技术文档：访问 /docs 查看完整的 API 文档", "Normal");

body.Append(new Paragraph(
    new ParagraphProperties(
        new Justification { Val = JustificationValues.Center },
        new SpacingBetweenLines { Before = "600" }
    )
));

body.Append(new Paragraph(
    new ParagraphProperties(
        new Justification { Val = JustificationValues.Center },
        new ParagraphBorders(
            new TopBorder { Val = BorderValues.Single, Size = 8, Space = 1, Color = "BFBFBF" }
        ),
        new SpacingBetweenLines { Before = "200" }
    ),
    new Run(
        new RunProperties(
            new Color { Val = "808080" },
            new FontSize { Val = "18" }
        ),
        new Text("Where To Eat — 校园餐厅真实评论平台") { Space = SpaceProcessingModeValues.Preserve }
    )
));

body.Append(sectPr);

doc.Save();
Console.WriteLine($"Document created: {outputPath}");
}

static Style CreateHeadingStyle(int level, string fontName, string sizeHalfPts, string color, bool bold, string spaceBefore, string spaceAfter)
{
    var rPr = new StyleRunProperties(
        new RunFonts { Ascii = fontName, HighAnsi = fontName, EastAsia = fontName, ComplexScript = fontName },
        new FontSize { Val = sizeHalfPts },
        new FontSizeComplexScript { Val = sizeHalfPts },
        new Color { Val = color }
    );
    if (bold) rPr.Append(new Bold());

    return new Style(
        new StyleName { Val = $"heading {level}" },
        new BasedOn { Val = "Normal" },
        new NextParagraphStyle { Val = "Normal" },
        new UIPriority { Val = 9 },
        new PrimaryStyle(),
        new StyleParagraphProperties(
            new KeepNext(),
            new KeepLines(),
            new SpacingBetweenLines { Before = spaceBefore, After = spaceAfter },
            new OutlineLevel { Val = level - 1 }
        ),
        rPr
    ) { Type = StyleValues.Paragraph, StyleId = $"Heading{level}", Default = false };
}

static void AddParagraph(Body body, string text, string styleId)
{
    body.Append(new Paragraph(
        new ParagraphProperties(new ParagraphStyleId { Val = styleId }),
        new Run(new Text(text) { Space = SpaceProcessingModeValues.Preserve })
    ));
}

static Table CreateFeatureTable(string[] headers, string[][] data)
{
    var table = new Table();

    var tblPr = new TableProperties(
        new TableWidth { Width = "5000", Type = TableWidthUnitValues.Pct },
        new TableBorders(
            new TopBorder { Val = BorderValues.Single, Size = 8, Space = 0, Color = "1F3864" },
            new BottomBorder { Val = BorderValues.Single, Size = 8, Space = 0, Color = "1F3864" },
            new LeftBorder { Val = BorderValues.None, Size = 0, Space = 0, Color = "auto" },
            new RightBorder { Val = BorderValues.None, Size = 0, Space = 0, Color = "auto" },
            new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4, Space = 0, Color = "D9D9D9" },
            new InsideVerticalBorder { Val = BorderValues.None, Size = 0, Space = 0, Color = "auto" }
        ),
        new TableCellMarginDefault(
            new TopMargin { Width = "57", Type = TableWidthUnitValues.Dxa },
            new StartMargin { Width = "85", Type = TableWidthUnitValues.Dxa },
            new BottomMargin { Width = "57", Type = TableWidthUnitValues.Dxa },
            new EndMargin { Width = "85", Type = TableWidthUnitValues.Dxa }
        )
    );
    table.Append(tblPr);

    var grid = new TableGrid();
    int colWidth = 9360 / headers.Length;
    foreach (var _ in headers)
        grid.Append(new GridColumn { Width = colWidth.ToString() });
    table.Append(grid);

    var headerRow = new TableRow();
    foreach (var h in headers)
    {
        headerRow.Append(new TableCell(
            new TableCellProperties(
                new TableCellWidth { Width = "0", Type = TableWidthUnitValues.Auto },
                new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = "1F3864" }
            ),
            new Paragraph(
                new ParagraphProperties(new SpacingBetweenLines { After = "0" }),
                new Run(
                    new RunProperties(new Bold(), new Color { Val = "FFFFFF" }),
                    new Text(h)
                )
            )
        ));
    }
    table.Append(headerRow);

    for (int i = 0; i < data.Length; i++)
    {
        var row = new TableRow();
        foreach (var cell in data[i])
        {
            var tcPr = new TableCellProperties(
                new TableCellWidth { Width = "0", Type = TableWidthUnitValues.Auto }
            );
            if (i % 2 == 1)
                tcPr.Append(new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = "F2F2F2" });

            row.Append(new TableCell(
                tcPr,
                new Paragraph(
                    new ParagraphProperties(new SpacingBetweenLines { After = "0" }),
                    new Run(new Text(cell))
                )
            ));
        }
        table.Append(row);
    }

    return table;
}

static Paragraph CreateCodeBlock(string code)
{
    return new Paragraph(
        new ParagraphProperties(
            new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = "F5F5F5" },
            new Indentation { Left = "360" },
            new SpacingBetweenLines { After = "160" }
        ),
        new Run(
            new RunFonts { Ascii = "Consolas", HighAnsi = "Consolas", EastAsia = "Microsoft YaHei" },
            new FontSize { Val = "20" },
            new Text(code) { Space = SpaceProcessingModeValues.Preserve }
        )
    );
}

static void AddPageNumberFooter(MainDocumentPart mainPart, SectionProperties sectPr)
{
    var footerPart = mainPart.AddNewPart<FooterPart>();
    footerPart.Footer = new Footer(
        new Paragraph(
            new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
            new SimpleField(
                new Run(
                    new RunProperties(
                        new FontSize { Val = "18" },
                        new Color { Val = "808080" }
                    ),
                    new Text("1")
                )
            ) { Instruction = " PAGE " }
        )
    );
    footerPart.Footer.Save();

    string footerPartId = mainPart.GetIdOfPart(footerPart);
    sectPr.Append(new FooterReference { Type = HeaderFooterValues.Default, Id = footerPartId });
}
